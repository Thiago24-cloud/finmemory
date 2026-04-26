/**
 * Reativa Burger King e Bela Madalena no mapa de preços.
 * Execute: node scripts/run-fix-store-pins.mjs
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://faxqrkxqfwjdavorxien.supabase.co';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZheHFya3hxZndqZGF2b3J4aWVuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTg1MTg1NiwiZXhwIjoyMDgxNDI3ODU2fQ.FGGSEwpyG-y721FzCvL42P6-TNLM6B5N1B_qdvjpOV4';

const sb = createClient(url, key);

async function run() {
  // 1. Verificar estado atual
  const { data: before } = await sb
    .from('stores')
    .select('id, name, type, active, lat, lng')
    .or('name.ilike.%burger king%,name.ilike.%bela madalena%,name.ilike.%bella madalena%')
    .order('name');

  console.log('\n--- Estado ANTES ---');
  for (const s of before || []) {
    console.log(`  [${s.active ? 'ATIVO' : 'INATIVO'}] ${s.name} | type=${s.type} | lat=${s.lat} lng=${s.lng}`);
  }

  // 2. Burger King: type=supermarket → restaurant (restaurante sempre visível, sem precisar de oferta)
  const { data: bkFixed, error: bkErr } = await sb
    .from('stores')
    .update({ active: true, type: 'restaurant' })
    .ilike('name', '%burger king%')
    .eq('type', 'supermarket')
    .select('id, name, type');

  if (bkErr) console.error('Erro Burger King:', bkErr.message);
  else console.log(`\nBurger King: ${bkFixed?.length ?? 0} loja(s) → type=restaurant`);

  // 3. Pizzaria Bella Madalena: type=supermarket → restaurant
  const { data: bmFixed, error: bmErr } = await sb
    .from('stores')
    .update({ active: true, type: 'restaurant' })
    .ilike('name', '%bella madalena%')
    .eq('type', 'supermarket')
    .select('id, name, type');

  if (bmErr) console.error('Erro Bella Madalena:', bmErr.message);
  else console.log(`Bella Madalena: ${bmFixed?.length ?? 0} loja(s) → type=restaurant`);

  // 4. Bela Madalena (grafia alternativa): bakery/padaria → restaurant
  const { data: bmType, error: bmTypeErr } = await sb
    .from('stores')
    .update({ active: true, type: 'restaurant' })
    .ilike('name', '%bela madalena%')
    .in('type', ['bakery', 'padaria', 'supermarket'])
    .select('id, name, type');

  if (bmTypeErr) console.error('Erro Bela Madalena (grafia alt):', bmTypeErr.message);
  else if (bmType?.length) console.log(`Bela Madalena: ${bmType.length} loja(s) → type=restaurant`);

  // 5. Estado final
  const { data: after } = await sb
    .from('stores')
    .select('id, name, type, active, lat, lng')
    .or('name.ilike.%burger king%,name.ilike.%bela madalena%,name.ilike.%bella madalena%')
    .order('name');

  console.log('\n--- Estado DEPOIS ---');
  for (const s of after || []) {
    console.log(`  [${s.active ? 'ATIVO' : 'INATIVO'}] ${s.name} | type=${s.type} | lat=${s.lat} lng=${s.lng}`);
  }

  // 6. Alertar sobre lat/lng nulos
  const semCoordenadas = (after || []).filter(s => !s.lat || !s.lng || s.lat === 0 || s.lng === 0);
  if (semCoordenadas.length) {
    console.warn('\n[AVISO] Lojas sem coordenadas válidas (pin não aparece no mapa):');
    for (const s of semCoordenadas) console.warn(`  ${s.name} — lat=${s.lat} lng=${s.lng}`);
  }
}

run().catch(console.error);
