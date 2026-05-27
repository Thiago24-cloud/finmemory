import { createHmac } from 'node:crypto';

function base64UrlEncode(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64url');
}

/**
 * Emite JWT curto para Supabase Realtime/RLS com sub = users.id (NextAuth supabaseId).
 * Requer SUPABASE_JWT_SECRET (Settings → API → JWT Secret no painel Supabase).
 */
export function mintSupabaseAccessToken(
  userId: string,
  jwtSecret: string,
  expiresInSec = 3600
): string {
  const sub = String(userId || '').trim();
  if (!sub) throw new Error('userId obrigatório');
  const secret = String(jwtSecret || '').trim();
  if (!secret) throw new Error('jwtSecret obrigatório');

  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64UrlEncode(
    JSON.stringify({
      aud: 'authenticated',
      exp: now + expiresInSec,
      iat: now,
      sub,
      role: 'authenticated',
    })
  );
  const data = `${header}.${payload}`;
  const signature = createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${signature}`;
}
