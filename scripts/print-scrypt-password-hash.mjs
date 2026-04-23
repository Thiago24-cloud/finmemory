#!/usr/bin/env node
/**
 * Gera password_hash no formato esperado por auth_local_users (scrypt via hashPassword).
 * Uso (não commite o output): node scripts/print-scrypt-password-hash.mjs 'SuaSenhaForte!1'
 */
import { hashPassword } from '../lib/passwordAuth.js';

const pwd = process.argv[2];
if (!pwd) {
  console.error('Uso: node scripts/print-scrypt-password-hash.mjs "<senha>"');
  process.exit(1);
}
const hash = hashPassword(pwd);
console.log(JSON.stringify({ password_hash: hash }, null, 0));
