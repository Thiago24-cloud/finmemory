import { createClient } from '@supabase/supabase-js';
import { processImageSync } from '../../../lib/catalog/processImageSync.js';
import { checkCatalogEnrichSecret } from '../../../lib/catalog/checkCatalogEnrichSecret.js';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * POST /api/catalog/process-image-sync
 * Body: { product: { nome, gtin?, imagem_url?, id?, persist? } }
 * Teste manual de um único produto (Cosmos → R2 → Supabase).
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!checkCatalogEnrichSecret(req)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase service role não configurado' });
  }

  const product = req.body?.product;
  if (!product || typeof product !== 'object') {
    return res.status(400).json({ error: 'Body.product obrigatório' });
  }

  try {
    const result = await processImageSync(supabase, product);
    return res.status(200).json({ ok: true, result });
  } catch (e) {
    console.error('[catalog/process-image-sync]', e?.message || e);
    return res.status(500).json({ error: e?.message || 'Erro interno' });
  }
}
