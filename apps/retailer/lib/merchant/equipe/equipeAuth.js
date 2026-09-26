import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { EQUIPE_PAPEIS, normalizePapel } from './equipeConstants';

export {
  EQUIPE_PAPEIS,
  EQUIPE_PAPEL_LABEL,
  EQUIPE_TABS_BY_PAPEL,
  normalizePapel,
} from './equipeConstants';

export function normalizePin(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length < 4 || digits.length > 6) return null;
  return digits;
}

export function hashPin(pin, salt) {
  return createHash('sha256').update(`${salt}:${pin}`).digest('hex');
}

export function createPinHash(pin) {
  const salt = randomBytes(16).toString('hex');
  return { salt, hash: hashPin(pin, salt) };
}

export function verifyPin(pin, salt, hash) {
  if (!pin || !salt || !hash) return false;
  const a = Buffer.from(hashPin(pin, salt), 'hex');
  const b = Buffer.from(String(hash), 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function normalizeStoreCode(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
}

function secret() {
  return (
    process.env.NEXTAUTH_SECRET ||
    process.env.EQUIPE_SESSION_SECRET ||
    'finmemory-equipe-dev-secret'
  );
}

export function signEquipeToken(payload, maxAgeSec = 60 * 60 * 12) {
  const body = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + maxAgeSec,
  };
  const data = Buffer.from(JSON.stringify(body)).toString('base64url');
  const sig = createHmac('sha256', secret()).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifyEquipeToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;
  const expected = createHmac('sha256', secret()).update(data).digest('base64url');
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (!payload?.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (!payload.equipeId || !payload.lojaId || !payload.papel) return null;
    return payload;
  } catch {
    return null;
  }
}

export const EQUIPE_COOKIE = 'fm_equipe_session';
