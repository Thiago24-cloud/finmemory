import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

let r2Client;

function getR2Client() {
  if (!r2Client) {
    const endpoint = process.env.CLOUDFLARE_R2_ENDPOINT;
    const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
    if (!endpoint || !accessKeyId || !secretAccessKey) return null;
    r2Client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return r2Client;
}

function getR2BucketName() {
  return process.env.CLOUDFLARE_R2_BUCKET || process.env.CLOUDFLARE_R2_BUCKET_NAME || '';
}

function getR2PublicBaseUrl() {
  return (
    process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL ||
    process.env.CLOUDFLARE_R2_PUBLIC_URL ||
    ''
  );
}

/** @returns {boolean} */
export function isR2Configured() {
  return Boolean(getR2Client() && getR2BucketName() && getR2PublicBaseUrl());
}

/**
 * @param {string} userId
 * @param {number} timestamp
 * @param {string} ext — sem ponto (ex: jpg)
 */
export function buildReceiptR2Key(userId, timestamp, ext) {
  const safeExt = String(ext || 'jpg').replace(/^\./, '').toLowerCase() || 'jpg';
  return `receipts/${userId}/${timestamp}.${safeExt}`;
}

/**
 * @param {Buffer} fileBuffer
 * @param {string} fileName — chave no bucket (ex: receipts/userId/123.jpg)
 * @param {string} mimeType
 * @returns {Promise<{ success: true, url: string, key: string } | { success: false, error: unknown }>}
 */
export async function uploadToR2(fileBuffer, fileName, mimeType) {
  const client = getR2Client();
  const bucketName = getR2BucketName();
  const publicBase = String(getR2PublicBaseUrl()).replace(/\/+$/, '');

  if (!client || !bucketName || !publicBase) {
    return { success: false, error: new Error('R2 não configurado (variáveis de ambiente em falta)') };
  }

  const key = String(fileName || '').replace(/^\/+/, '');
  if (!key) {
    return { success: false, error: new Error('fileName vazio') };
  }

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: mimeType,
      })
    );

    const fileUrl = `${publicBase}/${key}`;
    return { success: true, url: fileUrl, key };
  } catch (error) {
    console.error('Erro ao fazer upload para o R2:', error);
    return { success: false, error };
  }
}

/**
 * @param {string} fileName
 * @returns {Promise<boolean>}
 */
export async function deleteFromR2(fileName) {
  const client = getR2Client();
  const bucketName = getR2BucketName();
  if (!client || !bucketName) return false;

  const key = String(fileName || '').replace(/^\/+/, '');
  if (!key) return false;

  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key,
      })
    );
    return true;
  } catch (error) {
    console.warn('Erro ao apagar objeto no R2:', key, error);
    return false;
  }
}

/**
 * Extrai a chave do objeto a partir da URL pública do CDN (ex.: finmemory.com.br/receipts/...).
 * @param {string} publicUrl
 * @returns {string | null}
 */
export function r2ObjectKeyFromPublicUrl(publicUrl) {
  const base = String(getR2PublicBaseUrl()).replace(/\/+$/, '');
  const url = String(publicUrl || '').trim();
  if (!base || !url) return null;

  const normalizedBase = base.toLowerCase();
  const normalizedUrl = url.toLowerCase();
  if (!normalizedUrl.startsWith(`${normalizedBase}/`)) return null;

  const key = url.slice(base.length).replace(/^\/+/, '');
  if (!key || key.includes('..')) return null;
  return key;
}

/**
 * @param {string} publicUrl
 * @returns {Promise<{ deleted: boolean, key?: string, reason?: string }>}
 */
export async function deleteReceiptFromR2ByPublicUrl(publicUrl) {
  const key = r2ObjectKeyFromPublicUrl(publicUrl);
  if (!key) {
    return { deleted: false, reason: 'not_managed_r2_url' };
  }
  const deleted = await deleteFromR2(key);
  return deleted ? { deleted: true, key } : { deleted: false, key, reason: 'delete_failed' };
}
