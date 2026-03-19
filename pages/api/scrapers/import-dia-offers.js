import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { geocodeAddress } from '../../../lib/geocode';

function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function extractJsonPayload(text) {
  if (!text) return null;
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return cleaned.slice(start, end + 1);
}

function stripHtmlToText(html) {
  if (!html) return '';
  return String(html)
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/?[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function asNumberBR(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  // Remove "R$", espaços e tenta normalizar 1.234,56 -> 1234.56
  const cleaned = s
    .replace(/R\$\s*/gi, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const importSecret = process.env.DIA_IMPORT_SECRET;
  const providedSecret =
    req.headers['x-cron-secret'] ||
    req.headers['X-Cron-Secret'] ||
    req.query?.secret;

  if (importSecret && providedSecret !== importSecret) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { storeUrl, lat: latProp, lng: lngProp } = req.body || {};
  if (!storeUrl || typeof storeUrl !== 'string' || !storeUrl.trim()) {
    return res.status(400).json({ error: 'storeUrl (string) é obrigatório' });
  }

  const openai = getOpenAI();
  if (!openai) return res.status(500).json({ error: 'OPENAI_API_KEY não configurada' });

  const url = storeUrl.trim();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Supabase service role não configurado' });
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const botUserId = process.env.DIA_BOT_USER_ID || '00000000-0000-0000-0000-000000000000';
  const categoryBase = 'Supermercado - Promoção';

  try {
    // 1) Baixa página
    const resp = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) FinMemory-PromoBot/1.0',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    if (!resp.ok) {
      return res.status(502).json({ error: `Falha ao baixar página: ${resp.status}` });
    }

    const html = await resp.text();
    const text = stripHtmlToText(html);
    const truncated = text.slice(0, 25000); // evita estouro de tokens

    // 2) Extrai promoções com GPT
    const extractionPrompt = `Você vai extrair PROMOÇÕES ATIVAS da página de uma loja do DIA (supermercado).

Regras:
- Retorne SOMENTE JSON válido, sem markdown.
- A página pode ter preço "De X,XX" e preço promocional "Por Y,YY". Use SEMPRE o preço promocional.
- Cada oferta deve ser um item: produto + preço promocional.
- Se existir validade (ex.: "Válida até 22/03/2026"), retorne em "valid_until" no formato YYYY-MM-DD. Se não existir, use null.
- Não inclua qualquer item sem preço promocional.

JSON esperado:
{
  "store_name": string,
  "offers": [
    {
      "product_name": string,
      "promo_price": number,
      "valid_until": string | null
    }
  ]
}

Conteúdo (texto extraído do HTML):
${truncated}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: extractionPrompt }],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });

    const raw = completion?.choices?.[0]?.message?.content || '';
    let jsonStr = extractJsonPayload(raw) || raw;
    const parsed = JSON.parse(jsonStr);

    const storeName = String(parsed?.store_name || '').trim();
    const offers = Array.isArray(parsed?.offers) ? parsed.offers : [];
    if (!storeName) {
      return res.status(422).json({ error: 'store_name não foi extraído' });
    }

    // 3) Coordenadas: usa lat/lng do request se vier, senão geocoda store_name
    let lat = latProp != null ? Number(latProp) : null;
    let lng = lngProp != null ? Number(lngProp) : null;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      const coords = await geocodeAddress(`${storeName}, Brasil`);
      if (!coords || coords.lat == null || coords.lng == null) {
        return res.status(422).json({ error: 'Não foi possível geocodar store_name para lat/lng' });
      }
      lat = coords.lat;
      lng = coords.lng;
    }

    // 4) Limpeza (MVP): remove promoções antigas desta store nas últimas 24h e re-insere
    const cutoffIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from('price_points')
      .delete()
      .eq('store_name', storeName)
      .gte('created_at', cutoffIso)
      .ilike('category', '%promo%');

    // 5) Insere price_points
    const pointsToInsert = offers
      .map((o) => {
        const product_name = String(o?.product_name || '').trim();
        const promo_price =
          typeof o?.promo_price === 'number' ? o.promo_price : asNumberBR(o?.promo_price);
        if (!product_name || promo_price == null || promo_price <= 0) return null;
        return {
          user_id: botUserId,
          product_name,
          price: promo_price,
          store_name: storeName,
          lat,
          lng,
          category: categoryBase,
          created_at: new Date().toISOString(),
        };
      })
      .filter(Boolean);

    if (pointsToInsert.length === 0) {
      return res.status(200).json({ success: true, storeName, inserted: 0, note: 'Nenhuma oferta válida extraída' });
    }

    const { error: insertErr } = await supabase.from('price_points').insert(pointsToInsert);
    if (insertErr) {
      return res.status(500).json({ error: insertErr.message || 'Erro ao inserir price_points' });
    }

    return res.status(200).json({
      success: true,
      storeName,
      offersExtracted: offers.length,
      inserted: pointsToInsert.length,
      categoryBase,
    });
  } catch (e) {
    console.error('import-dia-offers error:', e);
    return res.status(500).json({ error: e?.message || 'Erro interno' });
  }
}

