#!/usr/bin/env node
/**
 * Teste real (somente leitura) do pipeline de aprovação da fila do bot.
 * Verifica:
 * - owner user_id válido para gravar price_points (evita FK)
 * - normalização de nome/preço
 * - quantos itens estão prontos / sem imagem / sem preço válido
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { resolveOwnerUserId } from '../lib/botPromoOwner.js';
import { splitProdutosByPublishReadiness } from '../lib/promoQueueProcessing.js';
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
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const reviewerEmail = process.env.AUTH_TEST_EMAIL || 'finmemory.oficial@gmail.com';
const ownerUserId = await resolveOwnerUserId(supabase, reviewerEmail);

if (!ownerUserId) {
  console.error('ERRO: owner user_id não resolvido. Configure BOT_PROMO_OWNER_USER_ID ou MAP_QUICK_ADD_BOT_USER_ID.');
  process.exit(2);
}

const { data: item, error } = await supabase
  .from('bot_promocoes_fila')
  .select('id,store_name,produtos,created_at')
  .eq('status', 'pendente')
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();

if (error) {
  console.error('Erro ao ler fila:', error.message);
  process.exit(1);
}
if (!item) {
  console.log(JSON.stringify({ ok: true, ownerUserIdResolved: true, note: 'Sem itens pendentes na fila.' }, null, 2));
  process.exit(0);
}

const split = splitProdutosByPublishReadiness(item.produtos);
let cacheHits = 0;
for (const p of split.pendingImage) {
  const normKey = normalizeMapProductImageKey(p._normalized_name || p.nome || p.name || '');
  if (!normKey) continue;
  // eslint-disable-next-line no-await-in-loop
  const { data } = await supabase
    .from('map_product_image_cache')
    .select('image_url')
    .eq('norm_key', normKey)
    .maybeSingle();
  if (data?.image_url) cacheHits += 1;
}

console.log(
  JSON.stringify(
    {
      ok: true,
      queueItemId: item.id,
      store: item.store_name,
      ownerUserIdResolved: ownerUserId,
      totals: {
        raw: Array.isArray(item.produtos) ? item.produtos.length : 0,
        readyDirect: split.ready.length,
        pendingImage: split.pendingImage.length,
        invalidPrice: split.invalid.length,
        cacheHitsOnPendingImage: cacheHits,
      },
    },
    null,
    2
  )
);

process.exit(0);
