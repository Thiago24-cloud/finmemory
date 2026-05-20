import { notifyNearbyUsersOfFlashOffer } from '../push/nearbyFlashOfferPush';

/**
 * Publica oferta do lojista no mapa (promotions + price_points com coords da loja).
 * Fluxo manual do varejista — não usa fila bot_promocoes_fila.
 */

function validUntilIsoDays(days = 7) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Oferta relâmpago: TTL mais curto no mapa (3 dias). */
export const FLASH_OFFER_MAP_DAYS = 3;
export const STANDARD_OFFER_MAP_DAYS = 7;

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{
 *   store: { id: string, name: string, lat?: number | null, lng?: number | null },
 *   userId: string,
 *   name: string,
 *   price: number,
 *   imageUrl?: string | null,
 *   description?: string | null,
 *   flashOffer?: boolean,
 *   produtoLojaId?: string | null,
 * }} payload
 */
export async function publishMerchantProductToMap(supabase, payload) {
  const { store, userId, name, price, imageUrl, description, flashOffer, produtoLojaId } = payload;
  if (store.needs_review === true) {
    return {
      ok: false,
      error:
        'Sua loja ainda está em análise. Aguarde aprovação da equipe FinMemory para publicar no mapa.',
    };
  }
  const lat = Number(store.lat);
  const lng = Number(store.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, error: 'Loja sem coordenadas. Atualize o endereço no cadastro.' };
  }

  const validUntil = validUntilIsoDays(flashOffer ? FLASH_OFFER_MAP_DAYS : STANDARD_OFFER_MAP_DAYS);
  const storeName = String(store.name || 'Loja').trim();

  const promoRow = {
    store_id: store.id,
    product_name: name,
    promo_price: price,
    store_name: storeName,
    product_image_url: imageUrl || null,
    active: true,
    is_individual_product: true,
    source: 'merchant_panel',
    valid_until: validUntil,
    validity_note: description ? String(description).slice(0, 500) : null,
  };

  const { error: promoErr } = await supabase.from('promotions').insert(promoRow);
  if (promoErr) {
    console.error('[publishMerchantProductToMap] promotions:', promoErr);
    return { ok: false, error: promoErr.message };
  }

  const ppRow = {
    user_id: userId,
    product_name: name,
    price,
    store_name: storeName,
    lat,
    lng,
    category: 'Supermercado - Promoção',
    source: 'merchant_panel',
  };
  if (imageUrl) ppRow.image_url = imageUrl;

  const { error: ppErr } = await supabase.from('price_points').insert(ppRow);
  if (ppErr) {
    console.error('[publishMerchantProductToMap] price_points:', ppErr);
    return { ok: false, error: ppErr.message };
  }

  let nearbyPush = null;
  if (flashOffer) {
    try {
      nearbyPush = await notifyNearbyUsersOfFlashOffer(supabase, {
        store,
        merchantUserId: userId,
        productName: name,
        price,
        produtoLojaId: produtoLojaId || null,
      });
    } catch (e) {
      console.error('[publishMerchantProductToMap] nearby push:', e?.message || e);
      nearbyPush = { ok: false, reason: 'push_error', notified: 0 };
    }
  }

  return { ok: true, validUntil, nearbyPush };
}
