import { createClient } from '@supabase/supabase-js';
import { fetchExternalProductImageResolved } from '../../../lib/externalProductImages';
import { needsThumbnailEnrichment } from '../../../lib/enrichMapPointImages';

function checkSecret(req) {
  const secret = process.env.DIA_IMPORT_SECRET?.trim();
  if (!secret) return true;
  const h = req.headers['x-cron-secret'] || req.query?.secret;
  return h === secret;
}

/**
 * POST /api/cron/backfill-map-images
 * Body/query: { source?: string, limit?: number }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!checkSecret(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return res.status(500).json({ error: 'Supabase não configurado' });
  }

  const body = req.method === 'POST' ? req.body || {} : {};
  const source = String(body.source || req.query?.source || '').trim() || null;
  const fast = String(body.fast ?? req.query?.fast ?? '1') !== '0';
  const limit = Math.min(
    25,
    Math.max(1, Number.parseInt(String(body.limit || req.query?.limit || '12'), 10) || 12)
  );

  const supabase = createClient(url, key);
  let q = supabase
    .from('price_points')
    .select('id, product_name, price, store_name, image_url, source')
    .ilike('category', '%promo%')
    .order('created_at', { ascending: false })
    .limit(400);
  if (source) q = q.eq('source', source);

  const { data: rows, error } = await q;
  if (error) return res.status(500).json({ error: error.message });

  const useCse =
    process.env.MAP_POINTS_GOOGLE_CSE_FALLBACK !== '0' &&
    Boolean(process.env.GOOGLE_API_KEY && process.env.GOOGLE_CSE_ID);

  const todo = (rows || []).filter((r) => needsThumbnailEnrichment(r.image_url)).slice(0, limit);
  const summary = [];

  const prevGeminiRefine = process.env.MAP_PRODUCT_IMAGE_GEMINI_REFINE;
  const prevVision = process.env.MAP_PRODUCT_IMAGE_VISION_VALIDATE;
  if (fast) {
    process.env.MAP_PRODUCT_IMAGE_GEMINI_REFINE = '0';
    process.env.MAP_PRODUCT_IMAGE_VISION_VALIDATE = '0';
  }

  for (const row of todo) {
    const name = String(row.product_name || '').trim();
    if (!name) continue;
    try {
      const { url: imgUrl } = await fetchExternalProductImageResolved(
        name,
        row.store_name || '',
        useCse,
        { price: row.price != null ? Number(row.price) : null }
      );
      if (!imgUrl) {
        summary.push({ id: row.id, ok: false, error: 'sem imagem' });
        continue;
      }
      const { error: upErr } = await supabase
        .from('price_points')
        .update({ image_url: imgUrl })
        .eq('id', row.id);
      summary.push({ id: row.id, ok: !upErr, product: name.slice(0, 60) });
    } catch (e) {
      summary.push({ id: row.id, ok: false, error: e?.message || String(e) });
    }
  }

  if (fast) {
    if (prevGeminiRefine !== undefined) process.env.MAP_PRODUCT_IMAGE_GEMINI_REFINE = prevGeminiRefine;
    else delete process.env.MAP_PRODUCT_IMAGE_GEMINI_REFINE;
    if (prevVision !== undefined) process.env.MAP_PRODUCT_IMAGE_VISION_VALIDATE = prevVision;
    else delete process.env.MAP_PRODUCT_IMAGE_VISION_VALIDATE;
  }

  const ok = summary.filter((s) => s.ok).length;
  return res.status(200).json({
    ok: true,
    fast,
    processed: summary.length,
    updated: ok,
    summary,
  });
}
