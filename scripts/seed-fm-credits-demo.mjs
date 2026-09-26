#!/usr/bin/env node
/**
 * Seed MVP FinMemory Credits — campanha demo + créditos iniciais.
 *
 *   node -r dotenv/config scripts/seed-fm-credits-demo.mjs
 *   node -r dotenv/config scripts/seed-fm-credits-demo.mjs --email=marmitaria@example.com
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local'), override: true });

const emailArg = process.argv.find((a) => a.startsWith('--email='));
const demoEmail = emailArg ? emailArg.split('=')[1] : process.env.FM_DEMO_USER_EMAIL || '';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

async function ensureDemoUser() {
  if (demoEmail) {
    const { data } = await supabase.from('users').select('id, email, name').ilike('email', demoEmail).maybeSingle();
    if (data) return data;
  }
  const { data: latest } = await supabase
    .from('users')
    .select('id, email, name')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return latest;
}

async function ensureCampaign() {
  const name = 'Cashback Óleo Parceiro';
  const { data: existing } = await supabase.from('fm_campaigns').select('*').eq('name', name).maybeSingle();
  if (existing) {
    if (existing.status !== 'active') {
      await supabase.from('fm_campaigns').update({ status: 'active' }).eq('id', existing.id);
    }
    return existing;
  }

  const { data, error } = await supabase
    .from('fm_campaigns')
    .insert({
      name,
      partner_name: 'Indústria Parceira Demo',
      product_name: 'Óleo de Soja 900ml',
      product_brand: 'Liza',
      reward_amount: 2.0,
      budget_total: 1000.0,
      budget_spent: 0,
      region: 'São Paulo',
      status: 'active',
      rules: { demo: true },
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data;
}

async function postLedger(userId, type, amount, description, metadata = {}) {
  const { data, error } = await supabase.rpc('fm_post_ledger_transaction', {
    p_user_id: userId,
    p_type: type,
    p_amount: amount,
    p_status: 'confirmed',
    p_source_type: 'admin',
    p_source_id: null,
    p_description: description,
    p_metadata: metadata,
    p_blockchain_tx_hash: null,
    p_blockchain_network: null,
    p_token_amount: null,
  });
  if (error) throw new Error(error.message);
  return data;
}

async function main() {
  console.log('FinMemory Credits — seed demo\n');

  const user = await ensureDemoUser();
  if (!user) {
    console.error('Nenhum usuário encontrado. Crie um login no app ou passe --email=');
    process.exit(1);
  }
  console.log(`Usuário demo: ${user.name || user.email} (${user.id})`);

  const campaign = await ensureCampaign();
  console.log(`Campanha: ${campaign.name} (${campaign.id})`);

  await supabase.rpc('fm_ensure_wallet', { p_user_id: user.id });

  const { count } = await supabase
    .from('fm_ledger_transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);

  if (!count) {
    await postLedger(user.id, 'cashback_granted', 5.0, 'Bônus de boas-vindas (demo seed)', {
      seed: true,
    });
    console.log('+ R$ 5,00 bônus cadastro');
  } else {
    console.log(`Carteira já tem ${count} transação(ões) — bônus não duplicado.`);
  }

  console.log('\nPróximos passos (ADM Bridge MVP):');
  console.log('  1. BLOCKCHAIN_AUDIT_MOCK=true no Cloud Run finmemorycomerciantes');
  console.log('  2. /parceiros/adm?hub=bridge&view=validar');
  console.log('  3. /parceiros/adm?hub=bridge&view=carteira');
  console.log('  4. /parceiros/adm?hub=bridge&view=demo');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
