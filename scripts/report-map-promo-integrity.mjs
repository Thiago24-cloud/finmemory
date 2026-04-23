#!/usr/bin/env node
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { resolveOwnerUserId } from '../lib/botPromoOwner.js';
function normalizeMapProductImageKey(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 200);
}


dotenv.config({ path: '.env.local' });
dotenv.config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const reviewer = process.env.AUTH_TEST_EMAIL || 'finmemory.oficial@gmail.com';
const ownerUserId = await resolveOwnerUserId(supabase, reviewer);

const cutoffIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
const { data: promoPoints, error: ppErr } = await supabase
  .from('price_points')
  .select('id,user_id,product_name,image_url,category,created_at')
  .ilike('category', '%promo%')
  .gte('created_at', cutoffIso)
  .limit(10000);
if (ppErr) {
  console.error(ppErr.message);
  process.exit(1);
}

const totalPromoPoints = promoPoints?.length || 0;
const queueOwnedPromoPoints = (promoPoints || []).filter((r) => ownerUserId && r.user_id === ownerUserId).length;
const suspectedBypassPromoPoints = totalPromoPoints - queueOwnedPromoPoints;
const promoPointsMissingImage = (promoPoints || []).filter((r) => !String(r.image_url || '').trim()).length;

const { data: agentRows, error: agErr } = await supabase
  .from('promocoes_supermercados')
  .select('id,nome_produto,imagem_url,supermercado,ativo,expira_em')
  .eq('ativo', true)
  .gt('expira_em', new Date().toISOString())
  .limit(20000);
if (agErr) {
  console.error(agErr.message);
  process.exit(1);
}
const agentActiveTotal = agentRows?.length || 0;
const agentDiaActive = (agentRows || []).filter(
  (r) => String(r.supermercado || '').toLowerCase().trim() === 'dia'
).length;
const agentMissingImage = (agentRows || []).filter((r) => !String(r.imagem_url || '').trim()).length;

const allNames = [
  ...(promoPoints || []).map((r) => r.product_name),
  ...(agentRows || []).filter((r) => !String(r.imagem_url || '').trim()).map((r) => r.nome_produto),
]
  .filter(Boolean)
  .map((n) => normalizeMapProductImageKey(n));
const uniqueNames = [...new Set(allNames)].filter(Boolean);
let cached = 0;
const chunk = 200;
for (let i = 0; i < uniqueNames.length; i += chunk) {
  const slice = uniqueNames.slice(i, i + chunk);
  // eslint-disable-next-line no-await-in-loop
  const { data } = await supabase.from('map_product_image_cache').select('norm_key').in('norm_key', slice);
  cached += (data || []).length;
}

console.log(
  JSON.stringify(
    {
      cutoff_last_30_days: cutoffIso,
      owner_user_id_for_queue_publish: ownerUserId,
      counts: {
        totalPromoPoints,
        queueOwnedPromoPoints,
        suspectedBypassPromoPoints,
        promoPointsMissingImage,
        agentActiveTotal,
        agentDiaActive,
        agentMissingImage,
        namesNeedingCuration: uniqueNames.length - cached,
      },
      sql_reference: {
        suspectedBypassPromoPoints:
          "SELECT COUNT(*) FROM public.price_points WHERE category ILIKE '%promo%' AND created_at >= now() - interval '30 days' AND user_id <> '<OWNER_USER_ID>';",
        missingImagesPricePoints:
          "SELECT COUNT(*) FROM public.price_points WHERE category ILIKE '%promo%' AND (image_url IS NULL OR btrim(image_url) = '');",
        missingImagesAgent:
          "SELECT COUNT(*) FROM public.promocoes_supermercados WHERE ativo = true AND expira_em > now() AND (imagem_url IS NULL OR btrim(imagem_url) = '');",
      },
    },
    null,
    2
  )
);

process.exit(0);
