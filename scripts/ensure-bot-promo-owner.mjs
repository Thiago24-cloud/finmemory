#!/usr/bin/env node
/**
 * Garante conta técnica em public.users para scrapers/cron (sem login humano).
 * Uso:
 *   node scripts/ensure-bot-promo-owner.mjs
 *   node scripts/ensure-bot-promo-owner.mjs --write-env
 */
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

export const BOT_PROMO_OWNER_EMAIL = 'scraper-auto@finmemory.local';
const BOT_NAME = 'FinMemory Promo Bot';

dotenv.config({ path: '.env.local' });
dotenv.config();

const writeEnv = process.argv.includes('--write-env');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.local');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

async function ensureBotUser() {
  const email = BOT_PROMO_OWNER_EMAIL.toLowerCase();
  const { data: existing, error: lookupErr } = await supabase
    .from('users')
    .select('id, email, name')
    .eq('email', email)
    .maybeSingle();

  if (lookupErr) {
    throw new Error(`lookup users: ${lookupErr.message}`);
  }
  if (existing?.id) {
    return { id: existing.id, email: existing.email, isNew: false };
  }

  const insert = {
    email,
    name: BOT_NAME,
    google_id: null,
    access_token: null,
    refresh_token: null,
    token_expiry: null,
    last_sync: new Date().toISOString(),
  };

  const { data: created, error: insertErr } = await supabase
    .from('users')
    .insert(insert)
    .select('id, email')
    .single();

  if (insertErr || !created?.id) {
    throw new Error(`insert users: ${insertErr?.message || 'sem id'}`);
  }
  return { id: created.id, email: created.email, isNew: true };
}

function upsertEnvLocal(userId) {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    console.warn('Arquivo .env.local não encontrado; não foi possível gravar.');
    return false;
  }
  const keys = ['BOT_PROMO_OWNER_USER_ID', 'DIA_BOT_USER_ID', 'MAP_QUICK_ADD_BOT_USER_ID'];
  let content = fs.readFileSync(envPath, 'utf8');
  for (const keyName of keys) {
    const re = new RegExp(`^${keyName}=.*$`, 'm');
    const line = `${keyName}=${userId}`;
    if (re.test(content)) {
      content = content.replace(re, line);
    } else {
      content += `\n# Conta técnica scraper/cron (${BOT_PROMO_OWNER_EMAIL})\n${line}\n`;
    }
  }
  fs.writeFileSync(envPath, content, 'utf8');
  return true;
}

const bot = await ensureBotUser();
const out = {
  ok: true,
  userId: bot.id,
  email: bot.email,
  isNew: bot.isNew,
  envVars: {
    BOT_PROMO_OWNER_USER_ID: bot.id,
    DIA_BOT_USER_ID: bot.id,
    MAP_QUICK_ADD_BOT_USER_ID: bot.id,
  },
};

if (writeEnv) {
  out.wroteEnvLocal = upsertEnvLocal(bot.id);
}

console.log(JSON.stringify(out, null, 2));
console.log('\nCloud Run: cole o mesmo UUID em BOT_PROMO_OWNER_USER_ID (não use e-mail de admin).');
if (!writeEnv) {
  console.log('Local: npm run promo:ensure-bot-owner -- --write-env');
}
