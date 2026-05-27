import { requireMapQuickAddAdminForApi } from '../../../lib/requireMapQuickAddAdminApi';
import {
  fetchGoogleCseCuratorCandidates,
  fetchOpenFoodFactsImageByName,
} from '../../../lib/externalProductImages';
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

function queuedRawName(p) {
  return String(p?.nome || p?.name || p?.product_name || '').trim();
}

function queuedImageUrl(p) {
  return String(p?.imagem_url || p?.image_url || p?.promo_image_url || '').trim();
}

function normalizeQueuedName(name) {
  return String(name || '')
    .replace(/r\$\s*\d+[.,]?\d*/gi, ' ')
    .replace(/\b\d+[.,]\d{2}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isHttpsImage(url) {
  return /^https:\/\//i.test(String(url || '').trim());
}

/**
 * GET — candidatos (catálogo sem imagem + nomes no mapa sem cache).
 * POST — body JSON:
 *   { action: 'candidates', product_name?: string, product_id?: uuid }
 *   { action: 'select', image_url: string, product_name?: string, product_id?: uuid, bot_queue_item_id?: uuid }
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

      const { data: agentRows, error: agentErr } = await supabase
        .from('promocoes_supermercados')
        .select('nome_produto, imagem_url')
        .eq('ativo', true)
        .gt('expira_em', new Date().toISOString())
        .order('atualizado_em', { ascending: false })
        .limit(1200);
      if (agentErr) return res.status(500).json({ error: agentErr.message });

      const namesRaw = [
        ...(pts || []).map((r) => r.product_name),
        ...(agentRows || [])
          .filter((r) => !String(r.imagem_url || '').trim())
          .map((r) => r.nome_produto),
      ].filter(Boolean);
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

      // Segunda fila: produtos pendentes do bot sem imagem.
      const { data: botRows, error: botErr } = await supabase
        .from('bot_promocoes_fila')
        .select('id, store_name, created_at, produtos')
        .eq('status', 'pendente')
        .order('created_at', { ascending: false })
        .limit(120);
      if (botErr) return res.status(500).json({ error: botErr.message });

      const botMissingRaw = [];
      for (const row of botRows || []) {
        const produtos = Array.isArray(row.produtos) ? row.produtos : [];
        for (const p of produtos) {
          const rawName = queuedRawName(p);
          if (!rawName) continue;
          if (queuedImageUrl(p)) continue;
          const normalizedName = normalizeQueuedName(rawName) || rawName;
          const normKey = normalizeMapProductImageKey(normalizedName);
          if (!normKey) continue;
          botMissingRaw.push({
            bot_queue_item_id: row.id,
            store_name: row.store_name || '',
            received_at: row.created_at || null,
            product_name: normalizedName,
            norm_key: normKey,
          });
        }
      }

      const uniqueBotMissing = [];
      const seenBot = new Set();
      for (const item of botMissingRaw) {
        const key = `${item.bot_queue_item_id}:${item.norm_key}`;
        if (seenBot.has(key)) continue;
        seenBot.add(key);
        if (!cachedSet.has(item.norm_key)) {
          uniqueBotMissing.push(item);
        }
      }

      return res.status(200).json({
        catalog_missing,
        map_names_missing,
        bot_queue_missing_images: uniqueBotMissing.slice(0, 200),
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
      let fallback = [];
      if (!urls.length) {
        const norm = normalizeMapProductImageKey(name);
        const { data: cacheHit } = await supabase
          .from('map_product_image_cache')
          .select('image_url')
          .eq('norm_key', norm)
          .maybeSingle();
        if (isHttpsImage(cacheHit?.image_url)) fallback.push(String(cacheHit.image_url).trim());

        const { data: pRows } = await supabase
          .from('products')
          .select('thumbnail_url')
          .ilike('name', `%${name}%`)
          .limit(3);
        for (const p of pRows || []) {
          if (isHttpsImage(p?.thumbnail_url)) fallback.push(String(p.thumbnail_url).trim());
        }

        const off = await fetchOpenFoodFactsImageByName(name);
        if (isHttpsImage(off)) fallback.push(String(off).trim());
      }
      const mergedCandidates = [...new Set([...(urls || []), ...fallback])].slice(0, 3);
      const payload = {
        candidates: mergedCandidates.map((url) => ({ url })),
        google_error: googleError || null,
        fallback_used: !urls.length && mergedCandidates.length > 0,
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
    const botQueueItemId = typeof body.bot_queue_item_id === 'string' ? body.bot_queue_item_id.trim() : null;
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

      if (botQueueItemId && cacheName) {
        const { data: queueRow, error: qErr } = await supabase
          .from('bot_promocoes_fila')
          .select('id, produtos')
          .eq('id', botQueueItemId)
          .maybeSingle();
        if (qErr) return res.status(500).json({ error: qErr.message });
        if (queueRow?.id) {
          const targetNorm = normalizeMapProductImageKey(cacheName);
          const patched = (Array.isArray(queueRow.produtos) ? queueRow.produtos : []).map((p) => {
            const raw = queuedRawName(p);
            const normalized = normalizeQueuedName(raw) || raw;
            const pNorm = normalizeMapProductImageKey(normalized);
            if (!pNorm || pNorm !== targetNorm) return p;
            const current = queuedImageUrl(p);
            if (current) return p;
            return { ...p, imagem_url: publicUrl };
          });
          const { error: uErr } = await supabase
            .from('bot_promocoes_fila')
            .update({ produtos: patched })
            .eq('id', botQueueItemId);
          if (uErr) return res.status(500).json({ error: uErr.message });
        }
      }

      if (cacheName) {
        const normTarget = normalizeMapProductImageKey(cacheName);
        if (normTarget) {
          const { data: ppRows } = await supabase
            .from('price_points')
            .select('id, product_name, image_url')
            .or('image_url.is.null,image_url.eq.')
            .order('created_at', { ascending: false })
            .limit(2000);
          const ppIds = (ppRows || [])
            .filter((r) => normalizeMapProductImageKey(r.product_name) === normTarget)
            .map((r) => r.id);
          if (ppIds.length) {
            const { error: ppUpdErr } = await supabase
              .from('price_points')
              .update({ image_url: publicUrl })
              .in('id', ppIds);
            if (ppUpdErr) return res.status(500).json({ error: ppUpdErr.message });
          }

          const { data: agRows } = await supabase
            .from('promocoes_supermercados')
            .select('id, nome_produto, imagem_url')
            .eq('ativo', true)
            .gt('expira_em', new Date().toISOString())
            .or('imagem_url.is.null,imagem_url.eq.')
            .order('atualizado_em', { ascending: false })
            .limit(2000);
          const agIds = (agRows || [])
            .filter((r) => normalizeMapProductImageKey(r.nome_produto) === normTarget)
            .map((r) => r.id);
          if (agIds.length) {
            const { error: agUpdErr } = await supabase
              .from('promocoes_supermercados')
              .update({ imagem_url: publicUrl })
              .in('id', agIds);
            if (agUpdErr) return res.status(500).json({ error: agUpdErr.message });
          }
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
