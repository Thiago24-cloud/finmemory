/**
 * Diagnóstico: loja Sacolão São Jorge (Vila Madalena) + promotions + promocoes_supermercados.
 * Uso: node -r dotenv/config scripts/diagnose-sacolao-store-promos.mjs
 */
import { createClient } from '@supabase/supabase-js';

/** Mesma lógica que lib/promotionValidity.js (evita import .js → aviso de tipo de módulo). */
function todayIsoSaoPaulo() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

function isPromotionEligibleForMapPin(row, todayYmd) {
  if (!row || !todayYmd) return false;
  const vd = row.valid_dates;
  if (Array.isArray(vd) && vd.length > 0) {
    const sorted = [...new Set(vd.map((d) => String(d).slice(0, 10)))].filter(Boolean).sort();
    if (!sorted.length) return false;
    const minD = sorted[0];
    const maxD = sorted[sorted.length - 1];
    return todayYmd >= minD && todayYmd <= maxD;
  }
  const vf = row.valid_from != null && row.valid_from !== '' ? String(row.valid_from).slice(0, 10) : null;
  const vu = row.valid_until != null && row.valid_until !== '' ? String(row.valid_until).slice(0, 10) : null;
  if (vf && todayYmd < vf) return false;
  if (vu && todayYmd > vu) return false;
  return true;
}

function stripEnv(v) {
  if (v == null) return '';
  const s = String(v).trim();
  if (s.length >= 2 && ((s[0] === '"' && s[s.length - 1] === '"') || (s[0] === "'" && s[s.length - 1] === "'"))) {
    return s.slice(1, -1).trim();
  }
  return s;
}

const url =
  stripEnv(process.env.NEXT_PUBLIC_SUPABASE_URL) ||
  stripEnv(process.env.SUPABASE_URL) ||
  stripEnv(process.env.VITE_SUPABASE_URL);
const key =
  stripEnv(process.env.SUPABASE_SERVICE_ROLE_KEY) ||
  stripEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
  stripEnv(process.env.VITE_SUPABASE_PUBLISHABLE_KEY);

if (!url || !key) {
  console.error(
    'Defina URL e chave no .env, por exemplo:\n' +
      '  NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (recomendado)\n' +
      '  ou VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY (anon; pode falhar RLS)'
  );
  process.exit(1);
}

const supabase = createClient(url, key);
const today = todayIsoSaoPaulo();

async function main() {
  console.log('Data SP (hoje):', today, '\n');

  const storeFilter = 'name.ilike.%Sacolão%Jorge%,name.ilike.%Sacolao%Jorge%';
  let { data: stores, error: sErr } = await supabase
    .from('stores')
    .select('id, name, address, lat, lng, active, neighborhood')
    .eq('active', true)
    .or(storeFilter);

  if (sErr?.message?.includes('active')) {
    ({ data: stores, error: sErr } = await supabase
      .from('stores')
      .select('id, name, address, lat, lng, neighborhood')
      .or(storeFilter));
  }
  if (sErr?.message?.includes('neighborhood')) {
    ({ data: stores, error: sErr } = await supabase
      .from('stores')
      .select('id, name, address, lat, lng')
      .or(storeFilter));
  }

  if (sErr) {
    console.error('Erro stores:', sErr.message);
    process.exit(1);
  }

  if (!stores?.length) {
    console.log('Nenhuma loja ativa com nome parecido "Sacolão … Jorge".');
    process.exit(0);
  }

  console.log('--- Lojas candidatas ---');
  for (const s of stores) {
    console.log(`  ${s.id}`);
    console.log(`    nome: ${s.name}`);
    console.log(`    endereço: ${s.address || '—'}`);
    console.log(`    lat/lng: ${s.lat}, ${s.lng}`);
    console.log('');
  }

  for (const store of stores) {
    let q = supabase
      .from('promotions')
      .select(
        'id, product_name, promo_price, active, is_individual_product, valid_from, valid_until, valid_dates, store_id, created_at'
      )
      .eq('store_id', store.id);

    let { data: allPromo, error: pErr } = await q;
    if (pErr?.message?.includes('is_individual_product')) {
      ({ data: allPromo, error: pErr } = await supabase
        .from('promotions')
        .select(
          'id, product_name, promo_price, active, valid_from, valid_until, valid_dates, store_id, created_at'
        )
        .eq('store_id', store.id));
    }

    if (pErr) {
      console.error(`promotions (${store.name}):`, pErr.message);
      continue;
    }

    const rows = allPromo || [];
    const indiv = rows.filter((r) => r.is_individual_product !== false);
    const activeIndiv = indiv.filter((r) => r.active === true);
    const eligible = activeIndiv.filter((r) => isPromotionEligibleForMapPin(r, today));

    console.log(`--- promotions para store_id ${store.id.slice(0, 8)}… ---`);
    console.log(`  Total linhas na loja: ${rows.length}`);
    console.log(`  is_individual_product≠false + active=true: ${activeIndiv.length}`);
    console.log(`  active=true + isPromotionEligibleForMapPin(hoje): ${eligible.length}`);
    if (rows.length && !activeIndiv.length) {
      console.log('  ⚠ Nenhuma linha com active=true (API filtra .eq("active", true)).');
    }
    if (activeIndiv.length && !eligible.length) {
      console.log('  ⚠ Todas as linhas active caem fora da vigência para o pin (hoje).');
      const sample = activeIndiv.slice(0, 3);
      for (const r of sample) {
        console.log(
          `    ex.: "${String(r.product_name).slice(0, 40)}" valid_from=${r.valid_from} valid_until=${r.valid_until} valid_dates=${JSON.stringify(r.valid_dates)}`
        );
      }
    }
    if (eligible.length) {
      console.log(`  ✓ Exemplos elegíveis (até 5):`);
      for (const r of eligible.slice(0, 5)) {
        console.log(`    - ${r.product_name} — R$ ${r.promo_price}`);
      }
    }
    console.log('');
  }

  const refLat = -23.5505;
  const refLng = -46.6833;
  const d = 0.08;
  const { data: agent, error: aErr } = await supabase
    .from('promocoes_supermercados')
    .select('id, nome_produto, preco, supermercado, lat, lng, expira_em, ativo')
    .eq('supermercado', 'saojorge')
    .eq('ativo', true)
    .gt('expira_em', new Date().toISOString())
    .gte('lat', refLat - d)
    .lte('lat', refLat + d)
    .gte('lng', refLng - d)
    .lte('lng', refLng + d)
    .limit(20);

  if (aErr) {
    console.log('promocoes_supermercados (saojorge ~Vila Madalena):', aErr.message);
  } else {
    console.log(`--- promocoes_supermercados (slug saojorge, bbox ~VM, expira > agora) ---`);
    console.log(`  count: ${agent?.length || 0}`);
    if (agent?.length) {
      for (const r of agent.slice(0, 5)) {
        console.log(`    - ${r.nome_produto} — ${r.preco} @ ${r.lat},${r.lng}`);
      }
    }
  }

  console.log(
    '\nDica: se active=0 linhas mas JSON existe no Git, rode o SQL em data/curadoria/*sacolao* no Supabase.'
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
