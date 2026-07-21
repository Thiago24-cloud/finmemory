#!/usr/bin/env node
/**
 * Gera (ou redefine) senha local e tenta enviar e-mail de acesso ao painel lojista.
 *
 * Uso:
 *   node scripts/issue-partner-access-email.mjs --email=finmemory.oficial@gmail.com
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { randomBytes, scryptSync } from 'crypto';
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
loadEnv({ path: path.join(root, '.env') });
loadEnv({ path: path.join(root, '.env.local'), override: true });
loadEnv({ path: path.join(root, '.env.production') });
loadEnv({ path: path.join(root, '.env.retailer.local'), override: true });

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;
const RETAILER_URL =
  process.env.FINMEMORY_RETAILER_CLOUD_RUN_URL ||
  'https://finmemory-retailer-836908221936.southamerica-east1.run.app';

function argValue(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : '';
}

function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = scryptSync(String(password), salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('hex')}$${derived.toString('hex')}`;
}

function generateInitialPassword() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(10);
  let body = '';
  for (let i = 0; i < 10; i += 1) body += alphabet[bytes[i] % alphabet.length];
  return `Fm-${body}`;
}

async function sendViaResend({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  const from = process.env.AUTH_EMAIL_FROM || 'FinMemory <no-reply@finmemory.com.br>';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[resend]', res.status, text.slice(0, 300));
    return false;
  }
  return true;
}

async function main() {
  const email = String(argValue('email') || process.argv[2] || '')
    .trim()
    .toLowerCase();
  const password = argValue('password') || generateInitialPassword();
  if (!email || !email.includes('@')) {
    console.error('Informe --email=alguem@dominio.com');
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Falta NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('id, email, name')
    .eq('email', email)
    .maybeSingle();

  if (userErr) {
    console.error('Erro users:', userErr.message);
    process.exit(1);
  }
  if (!user?.id) {
    console.error(`Usuário não encontrado: ${email}`);
    process.exit(1);
  }

  const { data: profile } = await supabase
    .from('merchant_store_profiles')
    .select('business_name')
    .eq('user_id', user.id)
    .maybeSingle();

  const nowIso = new Date().toISOString();
  const { error: authErr } = await supabase.from('auth_local_users').upsert(
    {
      email: user.email,
      user_id: user.id,
      password_hash: hashPassword(password),
      email_verified_at: nowIso,
      email_verify_token_hash: null,
      email_verify_expires_at: null,
      email_verify_token_hashes: [],
      updated_at: nowIso,
    },
    { onConflict: 'email' }
  );
  if (authErr) {
    console.error('Erro auth_local_users:', authErr.message);
    process.exit(1);
  }

  const loginUrl = `${RETAILER_URL}/login?callbackUrl=${encodeURIComponent('/parceiros/painel')}`;
  const storeLine = profile?.business_name
    ? `<p>Loja: <strong>${profile.business_name}</strong></p>`
    : '';
  const html = `<p>Olá, ${user.name || 'parceiro'}!</p>
    <p>Seu acesso ao painel da loja está pronto.</p>
    ${storeLine}
    <p><strong>Link de entrada:</strong><br/><a href="${loginUrl}">${loginUrl}</a></p>
    <p><strong>E-mail:</strong> ${user.email}<br/><strong>Senha:</strong> ${password}</p>`;

  const emailed = await sendViaResend({
    to: user.email,
    subject: 'Seu acesso ao FinMemory Parceiros',
    html,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        email: user.email,
        emailed,
        password,
        loginUrl,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
