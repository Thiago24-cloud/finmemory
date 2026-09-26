#!/usr/bin/env node
/**
 * Verifica e prepara o Bridge MVP na ADM (Supabase + seed créditos).
 *
 *   node -r dotenv/config scripts/verify-bridge-adm-setup.mjs
 *   node -r dotenv/config scripts/verify-bridge-adm-setup.mjs --seed
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local'), override: true });

const shouldSeed = process.argv.includes('--seed');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('❌ Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local');
  process.exit(1);
}

const supabase = createClient(url, key);

async function tableOk(name, probe) {
  const { error } = await probe();
  if (!error) return { ok: true };
  const msg = String(error.message || error);
  if (/does not exist|relation.*not found/i.test(msg)) {
    return { ok: false, missing: true, msg };
  }
  return { ok: false, missing: false, msg };
}

async function main() {
  console.log('FinMemory Bridge ADM — verificação\n');
  console.log(`Supabase: ${url}\n`);

  const checks = [
    {
      label: 'insumos_loja (Catálogo)',
      file: 'supabase/run-insumos-loja-migration.sql',
      run: () => tableOk('insumos_loja', () => supabase.from('insumos_loja').select('id', { head: true, count: 'exact' })),
    },
    {
      label: 'notas_entrada_loja (Nota fiscal)',
      file: 'supabase/run-insumos-loja-migration.sql',
      run: () =>
        tableOk('notas_entrada_loja', () =>
          supabase.from('notas_entrada_loja').select('id', { head: true, count: 'exact' })
        ),
    },
    {
      label: 'fm_wallets (Carteira)',
      file: 'supabase/migrations/20260725120000_fm_credits_wallet_campaign.sql',
      run: () => tableOk('fm_wallets', () => supabase.from('fm_wallets').select('id', { head: true, count: 'exact' })),
    },
    {
      label: 'fm_campaigns (Campanhas)',
      file: 'supabase/migrations/20260725120000_fm_credits_wallet_campaign.sql',
      run: () => tableOk('fm_campaigns', () => supabase.from('fm_campaigns').select('id', { head: true, count: 'exact' })),
    },
    {
      label: 'fm_ledger_transactions (Auditoria)',
      file: 'supabase/migrations/20260725120000_fm_credits_wallet_campaign.sql',
      run: () =>
        tableOk('fm_ledger_transactions', () =>
          supabase.from('fm_ledger_transactions').select('id', { head: true, count: 'exact' })
        ),
    },
  ];

  let allOk = true;
  const missing = [];

  for (const c of checks) {
    const r = await c.run();
    if (r.ok) {
      console.log(`✅ ${c.label}`);
    } else if (r.missing) {
      allOk = false;
      missing.push(c);
      console.log(`❌ ${c.label} — tabela ausente`);
      console.log(`   → Rode: ${c.file}`);
    } else {
      allOk = false;
      console.log(`⚠️  ${c.label} — ${r.msg}`);
    }
  }

  const { count: insumoCount } = await supabase
    .from('insumos_loja')
    .select('id', { count: 'exact', head: true });
  console.log(`\n📦 Insumos no banco: ${insumoCount ?? 0}`);

  const { data: stores } = await supabase.from('stores').select('id, name').order('created_at', { ascending: false }).limit(5);
  console.log(`🏪 Lojas (top 5): ${(stores || []).map((s) => s.name || s.id.slice(0, 8)).join(', ') || '—'}`);

  const adminEmails = process.env.FINMEMORY_ADMIN_EMAILS || '';
  if (adminEmails.trim()) {
    console.log(`🔐 FINMEMORY_ADMIN_EMAILS: configurado (${adminEmails.split(',').length} e-mail(s))`);
  } else {
    console.log('⚠️  FINMEMORY_ADMIN_EMAILS não definido — /parceiros/adm bloqueado');
  }

  if (missing.length) {
    console.log('\n--- SQL créditos (cole no Supabase SQL Editor) ---');
    try {
      const sqlPath = resolve(process.cwd(), 'supabase/migrations/20260725120000_fm_credits_wallet_campaign.sql');
      const preview = readFileSync(sqlPath, 'utf8').split('\n').slice(0, 5).join('\n');
      console.log(preview + '\n... (arquivo completo no repo)\n');
    } catch {
      /* ignore */
    }
  }

  if (shouldSeed && !missing.some((m) => m.label.includes('fm_'))) {
    console.log('\n🌱 Rodando seed de créditos demo...');
    const { execSync } = await import('child_process');
    execSync('node -r dotenv/config scripts/seed-fm-credits-demo.mjs', {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
  } else if (!missing.some((m) => m.label.includes('fm_')) && shouldSeed === false) {
    console.log('\n💡 Para criar campanha demo + bônus na carteira:');
    console.log('   node -r dotenv/config scripts/verify-bridge-adm-setup.mjs --seed');
  }

  console.log('\n🔗 Testar no app:');
  console.log('   http://localhost:3001/parceiros/adm?hub=bridge&view=catalogo');
  console.log('   http://localhost:3001/parceiros/adm?hub=bridge&view=campanhas');
  console.log('   http://localhost:3001/parceiros/adm?hub=bridge&view=carteira');
  console.log('   http://localhost:3001/parceiros/adm?hub=bridge&view=demo');

  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
