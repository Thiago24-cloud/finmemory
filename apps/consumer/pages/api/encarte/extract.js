import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import {
  getEncarteVisionProvider,
  parseVisionJsonResponse,
  runEncarteVision,
} from '../../../lib/encarteVisionProvider';
import {
  computeDiscountPct,
  flyerProductDedupeKey,
  normalizeVisionValidDates,
  parseFlexibleDateToIso,
  parsePromoPriceNumber,
} from '../../../lib/flyerVisionParse';

const VISION_CATEGORIES = [
  'Hortifruti',
  'Carnes',
  'Laticínios',
  'Bebidas',
  'Mercearia',
  'Higiene',
  'Limpeza',
  'Congelados',
  'Padaria',
  'Outros',
];

function checkCronSecret(req) {
  const secret =
    process.env.CRON_SECRET?.trim() || process.env.ENCARTE_EXTRACT_SECRET?.trim();
  if (!secret) return true;
  const h = req.headers['x-cron-secret'] || req.headers['X-Cron-Secret'];
  return h === secret;
}

function sanitizeNome(s) {
  if (s == null) return '';
  return String(s).replace(/\s+/g, ' ').trim().slice(0, 280);
}

function sanitizeVisionCategory(raw) {
  if (raw == null) return null;
  const t = String(raw).replace(/\s+/g, ' ').trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  for (const c of VISION_CATEGORIES) {
    if (c.toLowerCase() === lower) return c;
  }
  return 'Outros';
}

function sanitizeUnit(raw) {
  if (raw == null) return null;
  const u = String(raw).replace(/\s+/g, ' ').trim().slice(0, 32);
  return u || null;
}

function isAllowedImageRef(ref) {
  if (!ref || typeof ref !== 'string') return false;
  const t = ref.trim();
  return t.startsWith('https://') || t.startsWith('data:image/');
}

/**
 * POST /api/encarte/extract
 * Processa o próximo item `pending` da fila: Vision → várias linhas em `promotions`.
 * Proteção opcional: header `x-cron-secret` = CRON_SECRET (recomendado em produção).
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!checkCronSecret(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const visionProvider = getEncarteVisionProvider();
  if (visionProvider === 'gemini') {
    if (!process.env.GEMINI_API_KEY?.trim()) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY não configurada (ENCARTE_VISION_PROVIDER=gemini)',
      });
    }
  } else if (visionProvider === 'openai') {
    if (!process.env.OPENAI_API_KEY?.trim()) {
      return res.status(500).json({ error: 'OPENAI_API_KEY não configurada' });
    }
  } else {
    return res.status(500).json({
      error: `ENCARTE_VISION_PROVIDER inválido: ${visionProvider} (use openai ou gemini)`,
    });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase admin não configurado' });
  }

  const { data: encarte, error: qErr } = await supabase
    .from('encarte_queue')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (qErr) {
    console.error('[encarte/extract] queue:', qErr.message);
    return res.status(500).json({ error: qErr.message });
  }
  if (!encarte) {
    return res.status(200).json({ message: 'Nenhum encarte pendente' });
  }

  await supabase.from('encarte_queue').update({ status: 'processing' }).eq('id', encarte.id);

  const imageUrl = encarte.image_url;
  if (!isAllowedImageRef(imageUrl)) {
    await supabase
      .from('encarte_queue')
      .update({
        status: 'error',
        error_msg: 'image_url inválida (use https:// ou data:image/)',
      })
      .eq('id', encarte.id);
    return res.status(422).json({ error: 'image_url inválida' });
  }

  const { data: storeRow, error: storeErr } = await supabase
    .from('stores')
    .select('id, name')
    .eq('id', encarte.store_id)
    .maybeSingle();

  if (storeErr || !storeRow?.name) {
    await supabase
      .from('encarte_queue')
      .update({
        status: 'error',
        error_msg: storeErr?.message || 'Loja não encontrada',
      })
      .eq('id', encarte.id);
    return res.status(404).json({ error: 'Loja não encontrada para store_id' });
  }

  const storeName = String(storeRow.name).slice(0, 200);
  const catList = VISION_CATEGORIES.join(' | ');
  const prompt = `Você analisa imagens de encartes e folhetos de supermercados brasileiros.

Extraia TODOS os produtos com preço promocional visível.
Cada produto = um objeto separado no array (não agrupe vários em um só).

## CAMPOS OBRIGATÓRIOS POR PRODUTO:
- product_name: nome completo (marca + descrição + gramagem)
- promo_price: preço principal (número com ponto: 5.99). OBRIGATÓRIO.
- category: exatamente uma de: ${catList}

## CAMPOS OPCIONAIS:
- original_price, club_price, club_name, unit, brand, image_hint, validity_note

## VALIDADE:
1. Semana inteira → valid_from + valid_until, valid_dates: null
2. Dias específicos → valid_dates: ["2026-04-06","2026-04-10"], valid_from e valid_until: null
3. Um dia → valid_dates: ["2026-04-07"]

## METADADOS DO ENCARTE:
- encarte_valid_from, encarte_valid_until (YYYY-MM-DD ou null)

Responda APENAS JSON (sem markdown):
{"encarte_valid_from":null,"encarte_valid_until":null,"products":[{"product_name":"string","category":"Hortifruti","promo_price":1.99,"valid_dates":null,"valid_from":null,"valid_until":null,"image_hint":null}]}`;

  const src = encarte.source || 'scraper';

  try {
    const { raw, model } = await runEncarteVision({ imageUrl, prompt });
    const parsed = parseVisionJsonResponse(raw);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Resposta do modelo não é JSON válido');
    }

    const products = Array.isArray(parsed?.products) ? parsed.products : [];
    const encarteFrom = parseFlexibleDateToIso(parsed?.encarte_valid_from);
    const encarteUntil = parseFlexibleDateToIso(parsed?.encarte_valid_until);
    const seen = new Set();
    const rows = [];
    const flyerHttps = String(imageUrl || '').trim().startsWith('https://') ? String(imageUrl).trim() : null;

    for (const p of products) {
      const product_name = sanitizeNome(p?.product_name);
      const promo_price = parsePromoPriceNumber(p?.promo_price);
      if (!product_name || promo_price == null) continue;

      const unit = sanitizeUnit(p?.unit);
      const dk = flyerProductDedupeKey(product_name, promo_price, unit);
      if (seen.has(dk)) continue;
      seen.add(dk);

      let original_price =
        p?.original_price != null && p.original_price !== ''
          ? parsePromoPriceNumber(p.original_price)
          : null;
      if (original_price != null && !Number.isFinite(original_price)) {
        original_price = null;
      }

      const club_price =
        p?.club_price != null && p.club_price !== '' ? parsePromoPriceNumber(p.club_price) : null;

      let valid_dates = normalizeVisionValidDates(p?.valid_dates);
      let valid_from = parseFlexibleDateToIso(p?.valid_from);
      let valid_until = parseFlexibleDateToIso(p?.valid_until);
      if (!valid_dates?.length && !valid_from && !valid_until && encarteFrom && encarteUntil) {
        valid_from = encarteFrom;
        valid_until = encarteUntil;
      }

      const image_hint =
        p?.image_hint != null && String(p.image_hint).trim()
          ? String(p.image_hint).replace(/\s+/g, ' ').trim().slice(0, 400)
          : null;

      let validity_note =
        p?.validity_note != null && String(p.validity_note).trim()
          ? String(p.validity_note).replace(/\s+/g, ' ').trim().slice(0, 400)
          : null;
      const ow = p?.offer_weekdays;
      if (Array.isArray(ow) && ow.length > 0) {
        const days = ow
          .map((d) => String(d || '').toLowerCase().trim())
          .filter(Boolean)
          .slice(0, 14);
        if (days.length) {
          const extra = `Dias: ${days.join(', ')}`;
          validity_note = validity_note ? `${validity_note} · ${extra}` : extra;
        }
      }
      if (valid_dates?.length && !validity_note) {
        validity_note = `Datas: ${valid_dates.join(', ')}`;
      }

      const discount_pct = computeDiscountPct(original_price, promo_price);

      rows.push({
        product_name,
        promo_price,
        original_price,
        club_price: club_price != null && Number.isFinite(club_price) ? club_price : null,
        unit,
        category: sanitizeVisionCategory(p?.category),
        store_name: storeName,
        valid_from: valid_dates?.length ? null : valid_from,
        valid_until: valid_dates?.length ? null : valid_until,
        valid_dates: valid_dates?.length ? valid_dates : null,
        active: true,
        store_id: encarte.store_id,
        encarte_queue_id: encarte.id,
        is_individual_product: true,
        source: src,
        flyer_image_url: flyerHttps,
        product_image_url: null,
        image_hint,
        discount_pct: discount_pct != null ? discount_pct : null,
        validity_note,
      });
    }

    if (!rows.length) {
      await supabase
        .from('encarte_queue')
        .update({
          status: 'error',
          error_msg: 'Nenhum produto com nome e preço promocional válidos',
          processed_at: new Date().toISOString(),
        })
        .eq('id', encarte.id);
      return res.status(422).json({
        error: 'Nenhum produto extraído',
        encarte_id: encarte.id,
        rawCount: products.length,
      });
    }

    const chunkSize = 200;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const slice = rows.slice(i, i + chunkSize);
      const { error: insertErr } = await supabase.from('promotions').insert(slice);
      if (insertErr) throw new Error(insertErr.message);
    }

    await supabase
      .from('encarte_queue')
      .update({
        status: 'done',
        processed_at: new Date().toISOString(),
        products_extracted: rows.length,
        error_msg: null,
      })
      .eq('id', encarte.id);

    return res.status(200).json({
      success: true,
      encarte_id: encarte.id,
      products_extracted: rows.length,
      model,
    });
  } catch (err) {
    console.error('[encarte/extract]', err?.message || err);
    await supabase
      .from('encarte_queue')
      .update({
        status: 'error',
        error_msg: err?.message || 'Erro desconhecido',
        processed_at: new Date().toISOString(),
      })
      .eq('id', encarte.id);
    return res.status(500).json({ error: err?.message || 'Erro ao processar encarte' });
  }
}
