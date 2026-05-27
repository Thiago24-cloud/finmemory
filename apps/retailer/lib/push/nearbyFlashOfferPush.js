import { sendOneSignalToUsers, isOneSignalConfigured } from './oneSignalSend';

const DEFAULT_RADIUS_KM = 3;
const DEFAULT_COOLDOWN_HOURS = 24;
const DEFAULT_LOCATION_MAX_AGE_HOURS = 168;

function radiusKm() {
  const n = Number(process.env.MERCHANT_NEARBY_PUSH_RADIUS_KM);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 10) : DEFAULT_RADIUS_KM;
}

function cooldownHours() {
  const n = Number(process.env.MERCHANT_NEARBY_PUSH_COOLDOWN_HOURS);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 72) : DEFAULT_COOLDOWN_HOURS;
}

function locationMaxAgeHours() {
  const n = Number(process.env.MERCHANT_NEARBY_PUSH_LOCATION_MAX_AGE_HOURS);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 24 * 14) : DEFAULT_LOCATION_MAX_AGE_HOURS;
}

function formatBrl(value) {
  return Number(value).toFixed(2).replace('.', ',');
}

/**
 * @param {{ name?: string, price: number, storeName: string }} p
 */
export function buildNearbyFlashOfferPushCopy(p) {
  const store = String(p.storeName || 'uma loja').trim();
  const product = String(p.name || 'oferta').trim();
  const price = formatBrl(p.price);
  return {
    title: 'Oferta rel├ómpago perto de voc├¬ ÔÜí',
    body: `${product} na ${store} ÔÇö R$ ${price}. Toque para ver no mapa.`,
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{
 *   store: { id: string, name: string, lat: number, lng: number },
 *   merchantUserId: string,
 *   productName: string,
 *   price: number,
 *   produtoLojaId?: string | null,
 * }} payload
 */
export async function notifyNearbyUsersOfFlashOffer(supabase, payload) {
  const { store, merchantUserId, productName, price, produtoLojaId } = payload;
  const lat = Number(store.lat);
  const lng = Number(store.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, reason: 'store_without_coords', notified: 0, eligible: 0 };
  }

  const raio = radiusKm();
  const { data: nearbyRows, error: rpcErr } = await supabase.rpc('usuarios_opt_in_proximos', {
    p_store_lat: lat,
    p_store_lng: lng,
    p_raio_km: raio,
    p_exclude_user_id: merchantUserId || null,
    p_max_location_age_hours: locationMaxAgeHours(),
  });

  if (rpcErr) {
    if (rpcErr.message?.includes('usuarios_opt_in_proximos')) {
      return { ok: false, reason: 'migration_pending', notified: 0, eligible: 0 };
    }
    console.error('[nearbyFlashOfferPush] rpc:', rpcErr.message);
    return { ok: false, reason: rpcErr.message, notified: 0, eligible: 0 };
  }

  const eligibleIds = (nearbyRows || []).map((r) => r.user_id).filter(Boolean);
  if (eligibleIds.length === 0) {
    return {
      ok: true,
      notified: 0,
      eligible: 0,
      radius_km: raio,
      onesignal_configured: isOneSignalConfigured(),
    };
  }

  const cooldownCutoff = new Date(Date.now() - cooldownHours() * 3600000).toISOString();
  const { data: recentLogs } = await supabase
    .from('nearby_offer_push_log')
    .select('user_id')
    .eq('store_id', store.id)
    .eq('campaign', 'merchant_flash')
    .eq('success', true)
    .gte('sent_at', cooldownCutoff)
    .in('user_id', eligibleIds);

  const recentlyNotified = new Set((recentLogs || []).map((r) => r.user_id));
  const targetIds = eligibleIds.filter((id) => !recentlyNotified.has(id));

  if (targetIds.length === 0) {
    return {
      ok: true,
      notified: 0,
      eligible: eligibleIds.length,
      skipped_cooldown: eligibleIds.length,
      radius_km: raio,
      onesignal_configured: isOneSignalConfigured(),
    };
  }

  const copy = buildNearbyFlashOfferPushCopy({
    name: productName,
    price,
    storeName: store.name,
  });

  const mapUrl =
    `${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || process.env.NEXTAUTH_URL?.replace(/\/$/, '') || 'https://finmemory.com.br'}/mapa?lat=${lat}&lng=${lng}&zoom=16`;

  const pushResult = await sendOneSignalToUsers(targetIds, {
    title: copy.title,
    body: copy.body,
    url: mapUrl,
  });

  const success = Boolean(pushResult.ok);
  const logRows = targetIds.map((userId) => ({
    user_id: userId,
    store_id: store.id,
    produto_loja_id: produtoLojaId || null,
    campaign: 'merchant_flash',
    success,
    provider: pushResult.skipped ? null : 'onesignal',
    error_message: success ? null : String(pushResult.reason || 'unknown').slice(0, 500),
  }));

  const { error: logErr } = await supabase.from('nearby_offer_push_log').insert(logRows);
  if (logErr) {
    console.warn('[nearbyFlashOfferPush] log insert:', logErr.message);
  }

  return {
    ok: success || pushResult.skipped,
    notified: success ? targetIds.length : 0,
    eligible: eligibleIds.length,
    skipped_cooldown: eligibleIds.length - targetIds.length,
    radius_km: raio,
    onesignal_configured: isOneSignalConfigured(),
    push_skipped: Boolean(pushResult.skipped),
    push_reason: pushResult.reason || null,
  };
}
