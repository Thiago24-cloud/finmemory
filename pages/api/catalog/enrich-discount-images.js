import { createClient } from '@supabase/supabase-js';
import {
  fetchGoogleCseImageByName,
  fetchOpenFoodFactsImageByName,
  isValidResolvedImage,
} from '../../../lib/externalProductImages';
import { getPublicProductImageUrl } from '../../../lib/productImageUrl';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function checkSecret(req) {
  const secret =
    process.env.CATALOG_ENRICH_SECRET ||
    process.env.CATALOG_REGISTER_SECRET ||
    process.env.DIA_IMPORT_SECRET;
  if (!secret) return true;
  const provided =
    req.headers['x-cron-secret'] ||
    req.headers['X-Cron-Secret'] ||
    req.query?.secret;
  return provided === secret;
}

async function resolveFromCatalog(supabase, productId) {
  if (!productId) return null;
  try {
    const { data, error } = await supabase
      .from('product_images')
      .select('storage_path')
      .eq('product_id', productId)
      .eq('is_primary', true)
      .limit(1)
      .maybeSingle();
    if (error || !data?.storage_path) return null;
    return getPublicProductImageUrl(data.storage_path);
  } catch (_) {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!checkSecret(req)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase service role não configurado' });
  }

  const limitRaw = Number(req.body?.limit ?? req.query?.limit ?? 120);
  const limit = Math.min(400, Math.max(10, Number.isFinite(limitRaw) ? limitRaw : 120));
  const nowIso = new Date().toISOString();

  try {
    const { data: rows, error } = await supabase
      .from('promocoes_supermercados')
      .select('id, nome_produto, supermercado, product_id, imagem_url')
      .eq('ativo', true)
      .gt('expira_em', nowIso)
      .order('atualizado_em', { ascending: false })
      .limit(limit);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const targets = (rows || []).filter((r) => !r?.imagem_url);
    let updated = 0;
    let tried = 0;
    const misses = [];

    for (const row of targets) {
      tried += 1;
      let imageUrl = await resolveFromCatalog(supabase, row.product_id);

      if (!imageUrl) {
        imageUrl = await fetchOpenFoodFactsImageByName(row.nome_produto);
      }
      if (!imageUrl) {
        imageUrl = await fetchGoogleCseImageByName(row.nome_produto, row.supermercado);
      }

      if (!isValidResolvedImage(imageUrl)) {
        misses.push({ id: row.id, nome_produto: row.nome_produto });
        continue;
      }

      const { error: updErr } = await supabase
        .from('promocoes_supermercados')
        .update({ imagem_url: imageUrl })
        .eq('id', row.id);
      if (!updErr) updated += 1;
    }

    return res.status(200).json({
      ok: true,
      considered: rows?.length || 0,
      tried_missing: tried,
      updated,
      missed: misses.slice(0, 30),
      notes: [
        'Ordem de fallback: catálogo -> Open Food Facts -> Google CSE (se configurado).',
        'Para Google, configure GOOGLE_API_KEY e GOOGLE_CSE_ID.',
      ],
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Erro interno' });
  }
}
