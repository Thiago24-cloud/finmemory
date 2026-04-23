#!/usr/bin/env node
/**
 * Teste HTTP ponta-a-ponta: CSRF + POST credentials (NextAuth v4).
 * Requer app acessível (ex.: npm run dev) e variáveis:
 *   AUTH_TEST_BASE_URL (default http://localhost:3000)
 *   AUTH_TEST_EMAIL
 *   AUTH_TEST_PASSWORD
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

const base = (process.env.AUTH_TEST_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const email = process.env.AUTH_TEST_EMAIL || 'finmemory.oficial@gmail.com';
const password = process.env.AUTH_TEST_PASSWORD || '';

if (!password) {
  console.error('Defina AUTH_TEST_PASSWORD no .env.local (ou ambiente) para executar o POST de login.');
  process.exit(1);
}

function joinSetCookie(res) {
  if (typeof res.headers.getSetCookie === 'function') {
    return res.headers.getSetCookie().join('; ');
  }
  const raw = res.headers.raw?.()['set-cookie'];
  if (Array.isArray(raw)) return raw.map((c) => c.split(';')[0]).join('; ');
  return '';
}

const csrfRes = await fetch(`${base}/api/auth/csrf`);
if (!csrfRes.ok) {
  console.error('Falha GET /api/auth/csrf', csrfRes.status);
  process.exit(1);
}
const csrfJson = await csrfRes.json();
const csrfToken = csrfJson?.csrfToken;
if (!csrfToken) {
  console.error('csrfToken ausente na resposta');
  process.exit(1);
}
const cookie1 = joinSetCookie(csrfRes);

const body = new URLSearchParams({
  csrfToken,
  email: email.trim().toLowerCase(),
  password,
  callbackUrl: `${base}/mapa`,
  json: 'true',
});

const signRes = await fetch(`${base}/api/auth/callback/credentials`, {
  method: 'POST',
  redirect: 'manual',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    Cookie: cookie1,
  },
  body,
});

const text = await signRes.text();
let parsed;
try {
  parsed = JSON.parse(text);
} catch {
  parsed = { raw: text.slice(0, 500) };
}

const sessionCookies = joinSetCookie(signRes);
const ok = Boolean(
  signRes.ok && !parsed.error && (typeof parsed.url === 'string' || signRes.status === 302)
);

console.log(
  JSON.stringify(
    {
      status: signRes.status,
      ok,
      nextAuthBody: parsed,
      sessionCookieReceived: Boolean(sessionCookies && sessionCookies.includes('next-auth.session-token')),
    },
    null,
    2
  )
);

if (!ok) {
  process.exit(1);
}

if (sessionCookies.includes('next-auth.session-token')) {
  const me = await fetch(`${base}/api/auth/session`, {
    headers: { Cookie: sessionCookies },
  });
  const session = await me.json().catch(() => ({}));
  console.log(JSON.stringify({ sessionEndpointOk: me.ok, sessionUserEmail: session?.user?.email }, null, 2));
}

process.exit(0);
