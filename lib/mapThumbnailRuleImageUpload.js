/**
 * Converte data URL (base64) em ficheiro no bucket map-thumbnail-rules; HTTPS passa validado.
 * @see supabase/migrations/20260412250000_storage_map_thumbnail_rules.sql
 */

import { randomBytes } from 'crypto';

export const MAP_THUMBNAIL_RULES_BUCKET = 'map-thumbnail-rules';

const MAX_IMAGE_BYTES = Math.min(
  Number.parseInt(process.env.MAP_THUMBNAIL_RULE_UPLOAD_MAX_MB || '3', 10) || 3,
  8
) * 1024 * 1024;

const MAX_HTTPS_URL_LEN = 2048;

/**
 * @param {string} mime
 * @returns {string}
 */
function mimeToExt(mime) {
  const m = String(mime || '').toLowerCase().split(';')[0].trim();
  if (m === 'image/jpeg' || m === 'image/jpg') return 'jpg';
  if (m === 'image/png') return 'png';
  if (m === 'image/webp') return 'webp';
  if (m === 'image/gif') return 'gif';
  if (m === 'image/avif') return 'avif';
  return 'bin';
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string | null | undefined} raw
 * @returns {Promise<string | null>}
 */
export async function resolveThumbnailRuleImageInput(supabase, raw) {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (!s) return null;

  if (/^https:\/\//i.test(s)) {
    if (s.length > MAX_HTTPS_URL_LEN) {
      throw new Error(`URL HTTPS demasiado longa (máx. ${MAX_HTTPS_URL_LEN} caracteres).`);
    }
    try {
      const u = new URL(s);
      if (u.protocol !== 'https:') throw new Error('Apenas HTTPS é aceite para URLs.');
    } catch (e) {
      if (e instanceof TypeError) throw new Error('URL HTTPS inválida.');
      throw e;
    }
    return s;
  }

  const comma = s.indexOf(',');
  if (comma === -1 || !/^data:image\//i.test(s)) {
    throw new Error(
      'Formato não suportado: cola uma URL https://… ou uma imagem em base64 (data:image/png;base64,…).'
    );
  }

  const header = s.slice(0, comma).trim();
  const b64 = s.slice(comma + 1).replace(/\s/g, '');
  const hm = /^data:(image\/(?:png|jpeg|jpg|webp|gif|avif));base64$/i.exec(header);
  if (!hm) {
    throw new Error('Só são aceites data URLs de imagem (png, jpeg, webp, gif, avif).');
  }

  let buf;
  try {
    buf = Buffer.from(b64, 'base64');
  } catch {
    throw new Error('Base64 inválido.');
  }
  if (!buf.length) throw new Error('Imagem vazia após descodificar.');
  if (buf.length > MAX_IMAGE_BYTES) {
    throw new Error(
      `Imagem demasiado grande (${Math.round(buf.length / 1024)} KB). Máximo ${Math.round(MAX_IMAGE_BYTES / 1024)} KB.`
    );
  }

  let contentType = hm[1].toLowerCase();
  if (contentType === 'image/jpg') contentType = 'image/jpeg';
  const ext = mimeToExt(contentType);
  const objectPath = `rules/${Date.now()}-${randomBytes(8).toString('hex')}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(MAP_THUMBNAIL_RULES_BUCKET)
    .upload(objectPath, buf, {
      contentType,
      upsert: false,
    });

  if (upErr) {
    if (/bucket|not found|Bucket/i.test(upErr.message)) {
      throw new Error(
        'Bucket Storage em falta: aplica a migração 20260412250000_storage_map_thumbnail_rules.sql no Supabase.'
      );
    }
    throw new Error(upErr.message || 'Falha ao enviar imagem para o Storage.');
  }

  const { data: pub } = supabase.storage.from(MAP_THUMBNAIL_RULES_BUCKET).getPublicUrl(objectPath);
  const url = pub?.publicUrl;
  if (!url) throw new Error('Não foi possível obter URL pública do ficheiro.');
  return url;
}
