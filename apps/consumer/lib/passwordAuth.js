import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;

function toHex(buf) {
  return Buffer.from(buf).toString('hex');
}

function fromHex(str) {
  return Buffer.from(str, 'hex');
}

/** True se o valor guardado em auth_local_users.password_hash foi produzido por hashPassword (scrypt). */
export function isScryptPasswordHash(encodedHash) {
  const parts = String(encodedHash || '').split('$');
  return parts.length === 6 && parts[0] === 'scrypt';
}

export function hashPassword(password) {
  const pwd = String(password || '');
  const salt = randomBytes(16);
  const derived = scryptSync(pwd, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${toHex(salt)}$${toHex(derived)}`;
}

export function verifyPassword(password, encodedHash) {
  try {
    const parts = String(encodedHash || '').split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const [, nStr, rStr, pStr, saltHex, hashHex] = parts;
    const N = Number.parseInt(nStr, 10);
    const r = Number.parseInt(rStr, 10);
    const p = Number.parseInt(pStr, 10);
    if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;
    const salt = fromHex(saltHex);
    const expected = fromHex(hashHex);
    const got = scryptSync(String(password || ''), salt, expected.length, { N, r, p });
    return timingSafeEqual(expected, got);
  } catch (_) {
    return false;
  }
}

