#!/usr/bin/env node
/**
 * Teste E2E de autenticação: reset de senha + login + sessão + recovery.
 * Não requer RESEND_API_KEY — injeta o token diretamente no banco (teste controlado).
 *
 * Uso: node scripts/test-auth-e2e.mjs [email]
 *   EMAIL padrão: thiagochimezie4@gmail.com
 *   Requer: npm run dev (servidor em http://localhost:3000)
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import { createHash, randomBytes } from 'crypto';

const BASE = (process.env.AUTH_TEST_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const TEST_EMAIL = (process.argv[2] || 'thiagochimezie4@gmail.com').trim().toLowerCase();
const TEST_PWD = `FinTest_${randomBytes(4).toString('hex')}!9`;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function sha256(raw) {
  return createHash('sha256').update(raw).digest('hex');
}

function log(label, data) {
  const ok = data?.ok !== false && !data?.error;
  const icon = ok ? '✅' : '❌';
  console.log(`${icon}  ${label}:`, JSON.stringify(data, null, 2));
  return ok;
}

// ── helpers HTTP ──────────────────────────────────────────────────────────────

async function getCookies(res) {
  if (typeof res.headers.getSetCookie === 'function') {
    return res.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
  }
  const raw = res.headers.raw?.()['set-cookie'];
  if (Array.isArray(raw)) return raw.map(c => c.split(';')[0]).join('; ');
  return '';
}

// ── Passo 1: banco de dados ───────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════');
console.log(` TESTE E2E DE AUTENTICAÇÃO — ${TEST_EMAIL}`);
console.log('═══════════════════════════════════════════════════════════\n');

const { data: dbRow, error: dbErr } = await supabase
  .from('auth_local_users')
  .select('email,email_verified_at,failed_login_attempts,lockout_until,password_hash')
  .eq('email', TEST_EMAIL)
  .maybeSingle();

if (dbErr || !dbRow) {
  console.error('❌  Conta não encontrada no banco:', dbErr?.message || 'sem dados');
  process.exit(1);
}

log('[DB] Estado inicial da conta', {
  email: dbRow.email,
  email_verified: !!dbRow.email_verified_at,
  failed_attempts: dbRow.failed_login_attempts,
  lockout_until: dbRow.lockout_until,
  hash_format: dbRow.password_hash?.split('$')[0] || 'desconhecido',
});

if (!dbRow.email_verified_at) {
  console.error('❌  Email não verificado. Execute o fluxo de verificação primeiro.');
  process.exit(1);
}

// ── Passo 2: injetar token de reset diretamente no banco ──────────────────────

const rawToken = randomBytes(32).toString('hex');
const tokenHash = sha256(rawToken);
const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();

const { error: injectErr } = await supabase
  .from('auth_local_users')
  .update({
    password_reset_token_hash: tokenHash,
    password_reset_expires_at: expires,
    password_reset_used_at: null,
    updated_at: new Date().toISOString(),
  })
  .eq('email', TEST_EMAIL);

if (injectErr) {
  console.error('❌  Falha ao injetar token no banco:', injectErr.message);
  process.exit(1);
}
console.log('✅  [DB] Token de reset injetado diretamente (sem email).\n');

// ── Passo 3: POST /api/auth/reset-password ────────────────────────────────────

const resetRes = await fetch(`${BASE}/api/auth/reset-password`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: TEST_EMAIL, token: rawToken, password: TEST_PWD }),
});
const resetBody = await resetRes.json().catch(() => ({}));
const resetOk = log('[API] POST /api/auth/reset-password', { status: resetRes.status, ...resetBody });
if (!resetOk) { process.exit(1); }

// ── Passo 4: CSRF token ───────────────────────────────────────────────────────

const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
const csrfJson = await csrfRes.json().catch(() => ({}));
const csrfCookies = await getCookies(csrfRes);
const csrfToken = csrfJson?.csrfToken;

log('[API] GET /api/auth/csrf', {
  status: csrfRes.status,
  csrfToken: csrfToken ? csrfToken.slice(0, 16) + '…' : null,
  cookieHasCsrf: csrfCookies.includes('next-auth.csrf-token'),
  cookieIsSecure: csrfCookies.includes('Secure'),
});

if (!csrfToken) {
  console.error('❌  CSRF token ausente — servidor provavelmente não está rodando.');
  process.exit(1);
}

// ── Passo 5: POST /api/auth/callback/credentials ─────────────────────────────

const loginBody = new URLSearchParams({
  csrfToken,
  email: TEST_EMAIL,
  password: TEST_PWD,
  callbackUrl: `${BASE}/mapa`,
  json: 'true',
});

const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
  method: 'POST',
  redirect: 'manual',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    Cookie: csrfCookies,
  },
  body: loginBody,
});

const loginText = await loginRes.text();
let loginParsed;
try { loginParsed = JSON.parse(loginText); } catch { loginParsed = { raw: loginText.slice(0, 300) }; }
const sessionCookies = await getCookies(loginRes);

const loginOk = log('[API] POST /api/auth/callback/credentials', {
  status: loginRes.status,
  body: loginParsed,
  sessionCookieReceived: sessionCookies.includes('next-auth.session-token'),
});

// ── Passo 6: GET /api/auth/session ────────────────────────────────────────────

const allCookies = [csrfCookies, sessionCookies].filter(Boolean).join('; ');
const sessionRes = await fetch(`${BASE}/api/auth/session`, {
  headers: { Cookie: allCookies },
});
const sessionJson = await sessionRes.json().catch(() => ({}));
const sessionOk = log('[API] GET /api/auth/session', {
  status: sessionRes.status,
  email: sessionJson?.user?.email,
  supabaseId: sessionJson?.user?.supabaseId,
  expires: sessionJson?.expires,
});

// ── Passo 7: verificar update no banco ────────────────────────────────────────

const { data: dbAfter } = await supabase
  .from('auth_local_users')
  .select('last_login_at,last_login_ip,failed_login_attempts')
  .eq('email', TEST_EMAIL)
  .maybeSingle();

log('[DB] Estado pós-login', {
  last_login_at: dbAfter?.last_login_at,
  last_login_ip: dbAfter?.last_login_ip,
  failed_attempts: dbAfter?.failed_login_attempts,
});

// ── Passo 8: limpar senha de teste do banco ───────────────────────────────────

// Não restaurar hash original (desconhecido); o usuário deve redefinir sua própria senha.
// Apenas limpa token de reset e invalida sessão de teste.
await supabase
  .from('auth_local_users')
  .update({ password_reset_token_hash: null, password_reset_expires_at: null, password_reset_used_at: null })
  .eq('email', TEST_EMAIL);

// ── Resultado ─────────────────────────────────────────────────────────────────

const allOk = resetOk && sessionOk;
console.log('\n' + '═'.repeat(60));
console.log(allOk ? '✅  TODOS OS TESTES PASSARAM' : '❌  ALGUM TESTE FALHOU');
if (!loginParsed?.error && sessionJson?.user?.email === TEST_EMAIL) {
  console.log(`\n   Login + Sessão validados para: ${sessionJson.user.email}`);
  console.log(`   supabaseId: ${sessionJson.user.supabaseId}`);
}
console.log('═'.repeat(60) + '\n');
if (allOk) {
  console.log('⚠️   A senha do banco foi alterada para a senha de teste.');
  console.log('    Use "Esqueci minha senha" no app para redefinir para uma senha permanente.\n');
}

process.exit(allOk ? 0 : 1);
