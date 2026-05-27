import {
  buildReceiptR2Key,
  deleteReceiptFromR2ByPublicUrl,
  isR2Configured,
  uploadToR2,
} from './uploadToR2';

const MAX_URL_LEN = 2048;
const MAX_IMAGE_BYTES = 2.5 * 1024 * 1024;

/**
 * Aceita apenas referência HTTP(S) — nunca data URL nem base64 no banco.
 * @param {unknown} value
 */
export function isHttpReceiptUrl(value) {
  const s = String(value || '').trim();
  if (!s || s.length > MAX_URL_LEN) return false;
  if (/^data:/i.test(s)) return false;
  return /^https:\/\//i.test(s);
}

/**
 * @param {unknown} value
 */
export function looksLikeReceiptBinaryPayload(value) {
  const s = String(value || '').trim();
  if (!s) return false;
  if (/^data:image\//i.test(s)) return true;
  if (s.length > 400 && !s.includes('://') && /^[A-Za-z0-9+/=\s]+$/.test(s.replace(/\s/g, ''))) {
    return true;
  }
  return false;
}

/**
 * @param {string} input
 */
function parseReceiptImageInput(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;

  const dataPrefix = raw.match(/^data:(image\/[\w+.-]+);base64,(.+)$/is);
  if (dataPrefix) {
    const contentType = dataPrefix[1].toLowerCase();
    const base64Data = dataPrefix[2].replace(/\s/g, '');
    const buf = Buffer.from(base64Data, 'base64');
    if (!buf.length || buf.length > MAX_IMAGE_BYTES) {
      throw new Error('Imagem do comprovante inválida ou muito grande.');
    }
    const ext = contentType.includes('png')
      ? 'png'
      : contentType.includes('webp')
        ? 'webp'
        : 'jpg';
    return { buffer: buf, contentType, ext };
  }

  if (looksLikeReceiptBinaryPayload(raw)) {
    const base64Data = raw.replace(/\s/g, '');
    const buf = Buffer.from(base64Data, 'base64');
    if (!buf.length || buf.length > MAX_IMAGE_BYTES) {
      throw new Error('Imagem do comprovante inválida ou muito grande.');
    }
    return { buffer: buf, contentType: 'image/jpeg', ext: 'jpg' };
  }

  return null;
}

/**
 * Resolve URL pública do comprovante para gravar em transacoes (receipt_image_url / url_comprovante).
 * 1) Se já for https → usa direto.
 * 2) Se vier base64/data URL → upload R2 e retorna URL.
 * 3) Caminhos internos (storage_path) são ignorados.
 *
 * @param {{ userId: string, receipt_image_url?: string, url_comprovante?: string, imageBase64?: string }} opts
 * @returns {Promise<string | null>}
 */
export async function resolveReceiptComprovanteUrl(opts) {
  const userId = opts?.userId;
  const candidates = [opts?.receipt_image_url, opts?.url_comprovante, opts?.imageBase64].filter(Boolean);

  for (const candidate of candidates) {
    if (isHttpReceiptUrl(candidate)) {
      return String(candidate).trim();
    }
  }

  const binarySource =
    opts?.imageBase64 ||
    candidates.find((c) => looksLikeReceiptBinaryPayload(c)) ||
    null;

  if (!binarySource) {
    const internal = candidates.find((c) => {
      const s = String(c).trim();
      return s && !s.includes('://') && !looksLikeReceiptBinaryPayload(s);
    });
    if (internal) {
      console.warn('[receiptComprovanteUrl] Ignorando caminho interno (use URL pública):', String(internal).slice(0, 80));
    }
    return null;
  }

  if (!userId) {
    throw new Error('userId é obrigatório para enviar comprovante ao armazenamento.');
  }

  if (!isR2Configured()) {
    throw new Error(
      'Comprovante em imagem requer R2 configurado. Processe a nota antes (OCR) ou configure CLOUDFLARE_R2_*.'
    );
  }

  const parsed = parseReceiptImageInput(binarySource);
  if (!parsed) return null;

  const key = buildReceiptR2Key(userId, Date.now(), parsed.ext);
  const uploaded = await uploadToR2(parsed.buffer, key, parsed.contentType);
  if (!uploaded.success) {
    throw new Error(uploaded.error?.message || 'Falha ao enviar comprovante para o R2');
  }

  return uploaded.url;
}

/**
 * Campos leves para INSERT em transacoes (sem binários).
 * @param {string | null} url
 */
export function receiptUrlDbFields(url) {
  const clean = url && isHttpReceiptUrl(url) ? String(url).trim() : null;
  return {
    receipt_image_url: clean,
    url_comprovante: clean,
  };
}

/** @param {Record<string, unknown> | null | undefined} row */
export function collectReceiptPublicUrls(row) {
  const urls = new Set();
  for (const field of ['receipt_image_url', 'url_comprovante']) {
    const u = row?.[field];
    if (u && isHttpReceiptUrl(u)) urls.add(String(u).trim());
  }
  return [...urls];
}

/**
 * Remove do R2 os comprovantes ligados à transação (ignora URLs que não são do nosso CDN).
 * @param {Record<string, unknown> | null | undefined} row
 * @param {{ exceptUrls?: string[] }} [opts]
 */
export async function deleteTransactionReceiptsFromR2(row, opts = {}) {
  const except = new Set((opts.exceptUrls || []).map((u) => String(u).trim()));
  const urls = collectReceiptPublicUrls(row).filter((u) => !except.has(u));
  const results = [];
  for (const url of urls) {
    results.push({ url, ...(await deleteReceiptFromR2ByPublicUrl(url)) });
  }
  return results;
}
