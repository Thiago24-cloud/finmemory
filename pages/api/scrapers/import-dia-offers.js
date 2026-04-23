import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { geocodeAddress } from '../../../lib/geocode';
import {
  INGEST_SOURCE_DIA_STORE_PAGE,
  buildDiaGptPromoRun,
  enqueuePromocoes,
} from '../../../lib/ingest';

const { buildDiaOffersExtractionPrompt } = require('../../../lib/diaOffersGptPrompt.js');

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

  const categoryBase = 'Supermercado - Promoção';
  const runId = randomUUID();

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

    // 2) Extrai promoções com GPT (prompt partilhado com jobs/agent.js — ver lib/diaOffersGptPrompt.js)
    const extractionPrompt = buildDiaOffersExtractionPrompt(truncated);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: extractionPrompt }],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });

    const raw = completion?.choices?.[0]?.message?.content || '';
    let jsonStr = extractJsonPayload(raw) || raw;
    const parsed = JSON.parse(jsonStr);

    const offers = Array.isArray(parsed?.offers) ? parsed.offers : [];
    const storeNameForGeo = String(parsed?.store_name || '').trim();

    // 3) Coordenadas: usa lat/lng do request se vier, senão geocoda store_name
    let lat = latProp != null ? Number(latProp) : null;
    let lng = lngProp != null ? Number(lngProp) : null;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      if (!storeNameForGeo) {
        return res.status(422).json({ error: 'store_name é obrigatório quando lat/lng não são enviados' });
      }
      const coords = await geocodeAddress(`${storeNameForGeo}, Brasil`);
      if (!coords || coords.lat == null || coords.lng == null) {
        return res.status(422).json({ error: 'Não foi possível geocodar store_name para lat/lng' });
      }
      lat = coords.lat;
      lng = coords.lng;
    }

    const built = buildDiaGptPromoRun(parsed, {
      lat,
      lng,
      runId,
      storePageUrl: url,
      mapCategory: categoryBase,
    });
    if ('error' in built) {
      return res.status(422).json({ error: built.error });
    }

    if (!built.pricePoints || built.pricePoints.length === 0) {
      return res.status(200).json({
        success: true,
        queued: false,
        runId,
        storeName: built.storeDisplayName,
        note: 'Nenhuma oferta válida extraída',
        offersExtracted: offers.length,
      });
    }

    const produtos = built.pricePoints.map((p) => ({
      nome: p.product_name || p.name || '',
      preco: p.price ?? null,
      imagem_url: p.image_url || null,
    }));

    const queued = await enqueuePromocoes(supabase, {
      storeName: built.storeDisplayName,
      storeAddress: built.storeAddress || null,
      storeLat: lat,
      storeLng: lng,
      produtos,
      origem: INGEST_SOURCE_DIA_STORE_PAGE,
    });

    if (!queued.ok) {
      return res.status(500).json({ error: `Erro ao enfileirar: ${queued.error}` });
    }

    return res.status(200).json({
      success: true,
      queued: true,
      runId,
      storeName: built.storeDisplayName,
      offersExtracted: offers.length,
      produtosEnfileirados: produtos.length,
      note: 'Enviado para fila de aprovação em /admin/bot-fila',
    });
  } catch (e) {
    console.error('import-dia-offers error:', e);
    return res.status(500).json({ error: e?.message || 'Erro interno' });
  }
}

