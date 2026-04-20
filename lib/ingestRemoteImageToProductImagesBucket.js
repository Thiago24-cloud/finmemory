import { randomBytes } from 'crypto';
import { getPublicProductImageUrl, PRODUCT_IMAGES_BUCKET } from './productImageUrl';

/**
 * Descarrega uma imagem HTTPS e devolve buffer + tipo para upload.
 * @param {string} url
 */
export async function downloadRemoteImageBuffer(url) {
  const res = await fetch(String(url || '').trim(), {
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; FinMemoryMapCurator/1.0)',
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    },
  });
  if (!res.ok) throw new Error(`Download falhou (HTTP ${res.status})`);
  const rawCt = res.headers.get('content-type') || '';
  const ct = rawCt.split(';')[0].trim().toLowerCase();
  if (!ct.startsWith('image/')) throw new Error('A URL não devolveu um tipo image/*');
  const buf = Buffer.from(await res.arrayBuffer());
  const maxB = 4 * 1024 * 1024;
  if (buf.length > maxB) throw new Error('Imagem demasiado grande (máx. 4 MB)');
  let ext = 'jpg';
  let uploadCt = 'image/jpeg';
  if (ct.includes('png')) {
    ext = 'png';
    uploadCt = 'image/png';
  } else if (ct.includes('webp')) {
    ext = 'webp';
    uploadCt = 'image/webp';
  } else if (ct.includes('gif')) {
    ext = 'gif';
    uploadCt = 'image/gif';
  } else if (ct.includes('jpeg') || ct.includes('jpg')) {
    ext = 'jpg';
    uploadCt = 'image/jpeg';
  }
  return { buf, ext, contentType: uploadCt };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} storagePath — sem barra inicial
 * @param {Buffer} buf
 * @param {string} contentType
 * @returns {Promise<string>} URL pública
 */
export async function uploadBufferToProductImagesBucket(supabase, storagePath, buf, contentType) {
  const path = String(storagePath || '').replace(/^\/+/, '');
  if (!path) throw new Error('storagePath vazio');
  const { error } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).upload(path, buf, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(error.message || 'Falha no upload para o Storage');
  const pub = getPublicProductImageUrl(path);
  if (!pub) throw new Error('NEXT_PUBLIC_SUPABASE_URL em falta');
  return pub;
}

/**
 * Gera caminho estável sob `curator-picks/` para a imagem escolhida.
 * @returns {Promise<{ publicUrl: string, storagePath: string }>}
 */
export async function ingestRemoteImageUrlToProductImages(supabase, sourceUrl) {
  const { buf, ext, contentType } = await downloadRemoteImageBuffer(sourceUrl);
  const storagePath = `curator-picks/${Date.now()}-${randomBytes(6).toString('hex')}.${ext}`;
  const publicUrl = await uploadBufferToProductImagesBucket(supabase, storagePath, buf, contentType);
  return { publicUrl, storagePath };
}
