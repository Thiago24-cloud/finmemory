import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/catalog/register-product-image
 * Liga um ficheiro já enviado ao bucket `product-images` a um produto e marca como principal no mapa.
 *
 * Auth: CATALOG_REGISTER_SECRET ou DIA_IMPORT_SECRET (header X-Cron-Secret ou ?secret=)
 *
 * Body JSON:
 * - productId (uuid, opcional) — se já existir produto
 * - gtin (string, opcional) — EAN; com name cria ou reutiliza produto
 * - name (string, obrigatório se criar por gtin sem productId)
 * - storagePath (string, obrigatório) — caminho dentro do bucket, ex. 789/front.webp
 * - isPrimary (boolean, default true)
 */

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function checkSecret(req) {
  const secret =
    process.env.CATALOG_REGISTER_SECRET || process.env.DIA_IMPORT_SECRET;
  if (!secret) return true;
  const provided =
    req.headers['x-cron-secret'] ||
    req.headers['X-Cron-Secret'] ||
    req.query?.secret;
  return provided === secret;
}

function normalizeStoragePath(p) {
  if (!p || typeof p !== 'string') return null;
  const s = p.replace(/^\/+/, '').trim();
  return s || null;
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

  const body = req.body || {};
  let productId = body.productId || body.product_id || null;
  const gtin =
    typeof body.gtin === 'string' && body.gtin.trim()
      ? body.gtin.trim()
      : null;
  const name =
    typeof body.name === 'string' && body.name.trim()
      ? body.name.trim()
      : null;
  const storagePath = normalizeStoragePath(body.storagePath || body.storage_path);
  const isPrimary = body.isPrimary !== false && body.is_primary !== false;

  if (!storagePath) {
    return res.status(400).json({ error: 'storagePath é obrigatório' });
  }

  try {
    if (!productId) {
      if (!gtin) {
        return res.status(400).json({
          error: 'Forneça productId ou gtin (+ name para criar produto)',
        });
      }
      if (!name) {
        return res.status(400).json({
          error: 'name é obrigatório ao criar produto por gtin',
        });
      }

      const { data: found, error: findErr } = await supabase
        .from('products')
        .select('id')
        .eq('gtin', gtin)
        .maybeSingle();

      if (findErr) {
        console.error('register-product-image find:', findErr);
        return res.status(500).json({ error: findErr.message });
      }

      if (found?.id) {
        productId = found.id;
      } else {
        const { data: created, error: insErr } = await supabase
          .from('products')
          .insert({ gtin, name })
          .select('id')
          .single();
        if (insErr) {
          console.error('register-product-image insert product:', insErr);
          return res.status(500).json({ error: insErr.message });
        }
        productId = created.id;
      }
    }

    if (isPrimary) {
      await supabase
        .from('product_images')
        .update({ is_primary: false })
        .eq('product_id', productId);
    }

    const { data: imgRow, error: imgErr } = await supabase
      .from('product_images')
      .insert({
        product_id: productId,
        storage_path: storagePath,
        is_primary: isPrimary,
        source: body.source && String(body.source).trim() ? String(body.source).trim() : null,
      })
      .select('id, product_id, storage_path, is_primary')
      .single();

    if (imgErr) {
      console.error('register-product-image insert image:', imgErr);
      return res.status(500).json({ error: imgErr.message });
    }

    return res.status(201).json({
      ok: true,
      product_id: productId,
      image: imgRow,
    });
  } catch (e) {
    console.error('register-product-image:', e);
    return res.status(500).json({ error: e.message || 'Erro interno' });
  }
}
