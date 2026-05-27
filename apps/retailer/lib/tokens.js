import { createHash, randomBytes, createHmac } from 'crypto';

function hashRaw(raw) {
  return createHash('sha256').update(raw).digest('hex');
}

export function generateOpaqueToken() {
  const raw = randomBytes(32).toString('hex');
  return { raw, hash: hashRaw(raw) };
}

export function hashToken(raw) {
  return hashRaw(String(raw || ''));
}

function b32encode(buf) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}

function b32decode(input) {
  const clean = String(input || '').replace(/=+$/g, '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of clean) {
    const idx = alphabet.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateTotpSecret() {
  return b32encode(randomBytes(20));
}

function totpCode(secret, counter) {
  const key = b32decode(secret);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', key).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const codeInt = ((hmac[offset] & 0x7f) << 24)
    | ((hmac[offset + 1] & 0xff) << 16)
    | ((hmac[offset + 2] & 0xff) << 8)
    | (hmac[offset + 3] & 0xff);
  return String(codeInt % 1000000).padStart(6, '0');
}

export function verifyTotpCode({ secret, code, window = 1, stepSec = 30 }) {
  const cleanCode = String(code || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleanCode)) return false;
  const nowCounter = Math.floor(Date.now() / 1000 / stepSec);
  for (let drift = -window; drift <= window; drift += 1) {
    if (totpCode(secret, nowCounter + drift) === cleanCode) return true;
  }
  return false;
}

export function getOtpAuthUrl({ issuer, accountName, secret }) {
  const iss = encodeURIComponent(issuer);
  const account = encodeURIComponent(accountName);
  return `otpauth://totp/${iss}:${account}?secret=${secret}&issuer=${iss}&algorithm=SHA1&digits=6&period=30`;
}
