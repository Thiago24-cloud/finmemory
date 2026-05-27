import { createClient } from '@supabase/supabase-js';
import { enqueueScraperRun } from '../../../lib/ingest/enqueueScraperRun.js';

function checkSecret(req) {
  const secret =
    process.env.CATALOG_ENRICH_SECRET ||
    process.env.CRON_SECRET ||
    process.env.DIA_IMPORT_SECRET;
  const provided =
    req.headers['x-cron-secret'] ||
    req.headers['X-Cron-Secret'] ||
    req.query?.secret;
  if (secret && provided !== secret) return false;
  if (!secret && process.env.NODE_ENV === 'production') return false;
  return true;
}

/**
 * POST /api/scrapers/enqueue-batch
 * Body: { origem, storeName, storeLat, storeLng, produtos[], storeAddress?, artifacts?, locality* }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!checkSecret(req)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Supabase service role não configurado' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const origem = String(body.origem || '').trim();
  const storeName = String(body.storeName || '').trim();
  const storeLat = Number(body.storeLat);
  const storeLng = Number(body.storeLng);
  const produtos = Array.isArray(body.produtos) ? body.produtos : [];

  if (!origem) return res.status(400).json({ error: 'origem é obrigatória' });
  if (!storeName) return res.status(400).json({ error: 'storeName é obrigatório' });
  if (!Number.isFinite(storeLat) || !Number.isFinite(storeLng)) {
    return res.status(400).json({ error: 'storeLat e storeLng são obrigatórios' });
  }
  if (!produtos.length) return res.status(400).json({ error: 'produtos não pode ser vazio' });

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const result = await enqueueScraperRun(supabase, {
      origem,
      storeName,
      storeAddress: body.storeAddress ?? null,
      storeLat,
      storeLng,
      localityScope: body.localityScope,
      localityCity: body.localityCity ?? null,
      localityRegion: body.localityRegion ?? null,
      localityState: body.localityState || 'SP',
      dddCode: body.dddCode ?? null,
      isStatewide: Boolean(body.isStatewide),
      produtos,
      artifacts: body.artifacts,
    });

    if (!result.ok) {
      return res.status(500).json({ error: result.error || 'Falha ao enfileirar' });
    }

    return res.status(200).json({
      success: true,
      queued: true,
      filaId: result.filaId,
      status: result.status,
      produtosTotal: result.produtosTotal,
      readiness: result.readiness,
      note: 'Aprovar em /admin/bot-fila antes de publicar no mapa',
    });
  } catch (e) {
    console.error('[scrapers/enqueue-batch]', e?.message || e);
    return res.status(500).json({ error: e?.message || 'Erro interno' });
  }
}
