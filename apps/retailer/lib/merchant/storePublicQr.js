/**
 * QR / URL pública da loja (painel B2B).
 * Espelho de apps/consumer/lib/loja/publicStore.js
 */

const SLUG_MAX = 48;

export function slugifyStoreName(name) {
  const base = String(name || 'loja')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX);
  return base || 'loja';
}

export function shortToken(len = 6) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < len; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export function buildQrImageUrl(data, size = 240) {
  const s = Math.min(600, Math.max(80, Number(size) || 240));
  return `https://api.qrserver.com/v1/create-qr-code/?size=${s}x${s}&data=${encodeURIComponent(data)}`;
}

export function consumerAppBaseUrl() {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_CONSUMER_APP_URL,
    process.env.APP_BASE_URL,
    'https://finmemory.com.br',
  ];
  for (const raw of candidates) {
    const u = String(raw || '').trim().replace(/\/$/, '');
    if (u.startsWith('http://') || u.startsWith('https://')) return u;
  }
  return 'https://finmemory.com.br';
}

export function buildStorePublicPath(slug) {
  return `/loja/${encodeURIComponent(slug)}`;
}

export function buildStorePublicUrl(slug, { src } = {}) {
  const path = buildStorePublicPath(slug);
  const base = consumerAppBaseUrl();
  if (src) return `${base}${path}?src=${encodeURIComponent(src)}`;
  return `${base}${path}`;
}

/**
 * Garante public_slug + store_qr_codes para a loja.
 */
export async function ensureStorePublicQr(supabase, store) {
  if (!supabase || !store?.id) return null;

  let slug = store.public_slug ? String(store.public_slug).trim() : '';

  if (!slug) {
    const base = slugifyStoreName(store.name);
    let assigned = null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = `${base}-${shortToken(5)}`;
      const { data, error } = await supabase
        .from('stores')
        .update({ public_slug: candidate })
        .eq('id', store.id)
        .select('public_slug')
        .maybeSingle();
      if (!error && data?.public_slug) {
        assigned = data.public_slug;
        break;
      }
      const { data: cur } = await supabase
        .from('stores')
        .select('public_slug')
        .eq('id', store.id)
        .maybeSingle();
      if (cur?.public_slug) {
        assigned = cur.public_slug;
        break;
      }
    }
    slug = assigned || `${base}-${shortToken(5)}`;
  }

  const targetPath = buildStorePublicPath(slug);
  const publicUrl = buildStorePublicUrl(slug, { src: 'qr' });

  const { data: existing } = await supabase
    .from('store_qr_codes')
    .select('id, code, target_path, active')
    .eq('store_id', store.id)
    .maybeSingle();

  if (existing?.code) {
    if (existing.target_path !== targetPath) {
      await supabase
        .from('store_qr_codes')
        .update({ target_path: targetPath, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    }
    return { slug, code: existing.code, targetPath, publicUrl };
  }

  const code = shortToken(10);
  const { data: created, error: insErr } = await supabase
    .from('store_qr_codes')
    .insert({
      store_id: store.id,
      code,
      target_path: targetPath,
      active: true,
      updated_at: new Date().toISOString(),
    })
    .select('code, target_path')
    .maybeSingle();

  if (insErr) {
    console.warn('[ensureStorePublicQr]', insErr.message);
    return { slug, code: null, targetPath, publicUrl, schemaMissing: /store_qr_codes|public_slug/i.test(insErr.message || '') };
  }

  return {
    slug,
    code: created?.code || code,
    targetPath: created?.target_path || targetPath,
    publicUrl,
  };
}
