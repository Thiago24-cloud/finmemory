#!/usr/bin/env node
/**
 * Leitura apenas: verifica se auth_local_users.password_hash está no formato scrypt.
 * Carrega .env.local depois .env (dotenv).
 *
 * Uso: node scripts/check-auth-local-password-format.mjs [email]
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import { isScryptPasswordHash, verifyPassword } from '../lib/passwordAuth.js';

const email = (process.argv[2] || 'finmemory.oficial@gmail.com').trim().toLowerCase();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no ambiente.');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const { data, error } = await supabase
  .from('auth_local_users')
  .select('email,email_verified_at,password_hash,lockout_until,failed_login_attempts')
  .eq('email', email)
  .maybeSingle();

if (error) {
  console.error('Erro Supabase:', error.message);
  process.exit(1);
}
if (!data) {
  console.log(JSON.stringify({ email, found: false }, null, 2));
  process.exit(0);
}

const testPwd = process.env.AUTH_TEST_PASSWORD;
const report = {
  email: data.email,
  found: true,
  email_verified_at: !!data.email_verified_at,
  lockout_until: data.lockout_until,
  failed_login_attempts: data.failed_login_attempts,
  password_hash_scrypt_format: isScryptPasswordHash(data.password_hash),
};

if (testPwd) {
  report.password_matches_AUTH_TEST_PASSWORD = verifyPassword(testPwd, data.password_hash);
}

console.log(JSON.stringify(report, null, 2));
const code = report.password_hash_scrypt_format ? 0 : 2;
if (!report.password_hash_scrypt_format) {
  console.error(
    '\nO hash na base não está no formato scrypt$... — login vai falhar até corrigir (use reset-password ou node scripts/print-scrypt-password-hash.mjs).'
  );
}
setTimeout(() => process.exit(code), 50);
