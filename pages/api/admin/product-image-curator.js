import { requireMapQuickAddAdminForApi } from '../../../lib/requireMapQuickAddAdminApi';
import { fetchGoogleCseCuratorCandidates } from '../../../lib/externalProductImages';
import { ingestRemoteImageUrlToProductImages } from '../../../lib/ingestRemoteImageToProductImagesBucket';
import { upsertImageCacheRow, normalizeMapProductImageKey } from '../../../lib/mapProductImageCache';

function dedupeByNormKey(names) {
  const seen = new Set();
  const out = [];
  for (const raw of names) {
    const n = String(raw || '').trim();
    if (n.length < 2) continue;
    const k = normalizeMapProductImageKey(n);
    if (k.length < 2 || seen.has(k)) continue;
    seen.add(k);
    out.push({ display_name: n, norm_key: k });
  }
  return out;
}

/**
 * GET — candidatos (catálogo sem imagem + nomes no mapa sem cache).
 * POST — body JSON:
 *   { action: 'candidates', product_name?: string, product_id?: uuid }
 *   { action: 'select', image_url: string, product_name?: string, product_id?: uuid }
 */
export default async function handler(req, res) {
  const ctx = await requireMapQuickAddAdminForApi(req, res);
  if (!ctx) return;
  const { supabase } = ctx;

  if (req.method === 'GET') {
    try {
      const { data: products, error: pErr } = await supabase
        .from('products')
        .select('id, name, gtin')
        .order('updated_at', { ascending: false })
        .limit(400);
      if (pErr) return res.status(500).json({ error: pErr.message });

      const { data: primaries, error: iErr } = await supabase
        .from('product_images')
        .select('product_id')
        .eq('is_primary', true);
      if (iErr) return res.status(500).json({ error: iErr.message });
      const hasPrimary = new Set((primaries || []).map((r) => r.product_id).filter(Boolean));

      const catalog_missing = (products || [])
        .filter((p) => p?.id && !hasPrimary.has(p.id))
        .slice(0, 120)
        .map((p) => ({ product_id: p.id, name: p.name, gtin: p.gtin || null }));

      const { data: pts, error: ptErr } = await supabase
        .from('price_points')
        .select('product_name')
        .order('created_at', { ascending: false })
        .limit(800);
      if (ptErr) return res.status(500).json({ error: ptErr.message });

      const namesRaw = (pts || []).map((r) => r.product_name).filter(Boolean);
      const uniqueNames = dedupeByNormKey(namesRaw).slice(0, 200);
      const normKeys = uniqueNames.map((x) => x.norm_key);
      let cachedSet = new Set();
      if (normKeys.length) {
        const chunk = 80;
        for (let i = 0; i < normKeys.length; i += chunk) {
          const slice = normKeys.slice(i, i + chunk);
          const { data: caches, error: cErr } = await supabase
            .from('map_product_image_cache')
            .select('norm_key')
            .in('norm_key', slice);
          if (cErr) return res.status(500).json({ error: cErr.message });
          for (const c of caches || []) {
            if (c?.norm_key) cachedSet.add(c.norm_key);
          }
        }
      }
      const map_names_missing = uniqueNames
        .filter((x) => !cachedSet.has(x.norm_key))
        .slice(0, 100)
        .map((x) => ({ product_name: x.display_name, norm_key: x.norm_key }));

      return res.status(200).json({
        catalog_missing,
        map_names_missing,
        google_cse_configured: Boolean(process.env.GOOGLE_API_KEY && process.env.GOOGLE_CSE_ID),
      });
    } catch (e) {
      return res.status(500).json({ error: e?.message || 'Erro ao listar candidatos' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const action = String(body.action || '').trim();

  if (action === 'candidates') {
    const productName =
      typeof body.product_name === 'string'
        ? body.product_name.trim()
        : typeof body.name === 'string'
          ? body.name.trim()
          : '';
    let name = productName;
    if (!name && body.product_id) {
      const { data: row, error } = await supabase
        .from('products')
        .select('name')
        .eq('id', body.product_id)
        .maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      if (!row?.name) return res.status(404).json({ error: 'Produto não encontrado' });
      name = String(row.name).trim();
    }
    if (!name) return res.status(400).json({ error: 'product_name ou product_id obrigatório' });
    try {
      const { urls, googleError, queries_tried } = await fetchGoogleCseCuratorCandidates(name, { max: 3 });
      const payload = {
        candidates: urls.map((url) => ({ url })),
        google_error: googleError || null,
      };
      if (process.env.NODE_ENV === 'development') payload.queries_tried = queries_tried;
      return res.status(200).json(payload);
    } catch (e) {
      return res.status(500).json({ error: e?.message || 'Erro no Google CSE' });
    }
  }

  if (action === 'select') {
    const imageUrl = typeof body.image_url === 'string' ? body.image_url.trim() : '';
    if (!imageUrl || !/^https:\/\//i.test(imageUrl)) {
      return res.status(400).json({ error: 'image_url https obrigatório' });
    }
    const productId = typeof body.product_id === 'string' ? body.product_id.trim() : null;
    const productName =
      typeof body.product_name === 'string'
        ? body.product_name.trim()
        : typeof body.map_product_name === 'string'
          ? body.map_product_name.trim()
          : '';

    if (!productId && !productName) {
      return res.status(400).json({ error: 'Envie product_id (catálogo) e/ou product_name (repositório mapa)' });
    }

    try {
      const { publicUrl, storagePath } = await ingestRemoteImageUrlToProductImages(supabase, imageUrl);

      if (productId) {
        await supabase.from('product_images').update({ is_primary: false }).eq('product_id', productId);
        const { error: insErr } = await supabase.from('product_images').insert({
          product_id: productId,
          storage_path: storagePath,
          is_primary: true,
          source: 'google_cse_curator',
        });
        if (insErr) return res.status(500).json({ error: insErr.message });
        await supabase
          .from('products')
          .update({ thumbnail_url: publicUrl, updated_at: new Date().toISOString() })
          .eq('id', productId);
      }

      let cacheName = productName;
      if (!cacheName && productId) {
        const { data: prow } = await supabase.from('products').select('name').eq('id', productId).maybeSingle();
        if (prow?.name) cacheName = String(prow.name).trim();
      }
      if (cacheName) {
        const ok = await upsertImageCacheRow(supabase, cacheName, publicUrl, 'google_cse_curator');
        if (!ok) {
          return res.status(500).json({ error: 'Não foi possível gravar no repositório map_product_image_cache' });
        }
      }

      return res.status(200).json({
        ok: true,
        public_url: publicUrl,
        storage_path: storagePath,
      });
    } catch (e) {
      return res.status(400).json({ error: e?.message || 'Falha ao gravar imagem' });
    }
  }

  return res.status(400).json({ error: 'action inválida (use candidates ou select)' });
}
