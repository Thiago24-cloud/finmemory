/**
 * Cruza lista ADM com preços do mapa (mesma fonte do Caça-Preço).
 * Usa busca rápida por nome (evita timeout da RPC com vários itens).
 */
import { geocodePartnerStoreAddress } from '../geocode';
import { compareListWithMapOffers } from '../shoppingListMapCompare';
import {
  filterRpcRowsByRadius,
  buildMapQuoteWhatsappMessage,
  normalizeWhatsAppDigitsLoose,
} from './whatsappQuote';
import { getStoreBrandLogoUrl } from './storeBrandLogo';
import { resolveQuoteProductImagesBatch } from './resolveQuoteProductImage';
import { buildConsumerMapUrl } from '../consumerAppUrl';
import { fetchMapOffersByProductNames } from './fetchMapOffersByProductNames';

/** Endereço/região a partir do cadastro do usuário ADM. */
export function buildUserRegionAddress(user) {
  if (!user) return '';
  const parts = [];
  const obs = String(user.observacoes || '').trim();
  if (obs && /\b(rua|av\.|avenida|alameda|estrada|rodovia|\d{1,5})\b/i.test(obs)) {
    parts.push(obs);
  }
  if (user.bairro) parts.push(String(user.bairro).trim());
  if (user.cidade) parts.push(String(user.cidade).trim());
  const joined = parts.filter(Boolean).join(', ');
  if (!joined) return 'São Paulo, SP';
  if (!/\b(sp|são paulo|sao paulo)\b/i.test(joined)) return `${joined}, São Paulo - SP`;
  return joined;
}

/**
 * @param {{
 *   supabase: import('@supabase/supabase-js').SupabaseClient,
 *   items: string[],
 *   address?: string|null,
 *   phone?: string|null,
 *   customerName?: string|null,
 *   radiusKm?: number,
 * }} opts
 */
export async function runAdmMapQuote(opts) {
  const {
    supabase,
    items: itemsRaw,
    address: addressIn,
    phone,
    customerName,
    radiusKm: radiusIn,
  } = opts;

  const items = (itemsRaw || [])
    .map((s) => String(s || '').trim())
    .filter((n) => n.length >= 2)
    .slice(0, 40);

  if (!items.length) {
    return { error: 'Nenhum produto na lista.', status: 400 };
  }

  const address = String(addressIn || '').trim() || null;
  const radiusKm = Math.min(25, Math.max(2, Number(radiusIn) || 8));
  const phoneDigits = normalizeWhatsAppDigitsLoose(phone || '') || null;
  const name = String(customerName || '').trim() || null;

  let coords = null;
  if (address) {
    coords = await geocodePartnerStoreAddress(address);
  }

  let rpcRows = [];
  try {
    rpcRows = await fetchMapOffersByProductNames(supabase, items, {
      perNameLimit: 50,
      concurrency: 4,
    });
  } catch (err) {
    console.warn('[adm/runAdmMapQuote] fast fetch', err?.message || err);
    return { error: 'Não foi possível buscar preços no mapa.', status: 500 };
  }

  // Fallback: RPC só com poucos itens (ela estoura timeout em listas longas).
  if ((!rpcRows || rpcRows.length === 0) && items.length <= 3) {
    const { data, error: rpcErr } = await supabase.rpc('buscar_lojas_por_produtos_lista', {
      produtos: items,
    });
    if (rpcErr) {
      console.warn('[adm/runAdmMapQuote] rpc', rpcErr.message);
      return { error: 'Não foi possível buscar preços no mapa.', status: 500 };
    }
    rpcRows = data || [];
  }

  if (!rpcRows?.length) {
    const comparedEmpty = compareListWithMapOffers(items, []);
    const mensagem = buildMapQuoteWhatsappMessage({
      customerName: name,
      address,
      stores: [],
      items,
    });
    return {
      status: 200,
      payload: {
        parsed: {
          address,
          phone_digits: phoneDigits,
          items,
          customer_name: name,
        },
        geo: coords
          ? { lat: coords.lat, lng: coords.lng, radius_km: radiusKm, geocoded: true }
          : { lat: null, lng: null, radius_km: radiusKm, geocoded: false },
        summary: comparedEmpty.summary,
        items_detail: comparedEmpty.items || [],
        stores: [],
        mensagem,
        whatsapp_url: phoneDigits
          ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(mensagem)}`
          : null,
        mapa_lista_url: buildConsumerMapUrl({
          lista: items,
          lat: coords?.lat,
          lng: coords?.lng,
          zoom: coords ? 14 : 11,
          from: 'adm',
        }),
        used_fallback_national: false,
        price_source: 'map',
      },
    };
  }

  const filtered =
    coords?.lat != null
      ? filterRpcRowsByRadius(rpcRows, coords.lat, coords.lng, radiusKm)
      : rpcRows;

  const compared = compareListWithMapOffers(items, filtered.length ? filtered : rpcRows);

  const imageNames = [
    ...items,
    ...(compared.items || []).flatMap((it) =>
      [it.listName, it.bestOffer?.produto_nome].filter(Boolean)
    ),
  ];
  const imageMap = await resolveQuoteProductImagesBatch(supabase, imageNames);

  const itemsDetail = (compared.items || []).map((it) => {
    const fromList = imageMap.get(it.listName);
    const fromOffer = it.bestOffer?.produto_nome
      ? imageMap.get(it.bestOffer.produto_nome)
      : null;
    const img = fromList?.url ? fromList : fromOffer;
    return {
      ...it,
      image_url: img?.url || null,
      image_source: img?.source || null,
    };
  });

  const stores = (compared.stores || []).slice(0, 12).map((s) => ({
    ...s,
    logo_url: getStoreBrandLogoUrl(s.storeName),
    lines: (s.lines || []).map((l) => {
      const img =
        imageMap.get(l.listName) || (l.productName ? imageMap.get(l.productName) : null);
      return {
        ...l,
        image_url: img?.url || null,
        image_source: img?.source || null,
      };
    }),
  }));

  const mensagem = buildMapQuoteWhatsappMessage({
    customerName: name,
    address,
    stores,
    items,
  });

  const waUrl = phoneDigits
    ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(mensagem)}`
    : null;

  const mapaUrl = buildConsumerMapUrl({
    lista: items,
    lat: coords?.lat,
    lng: coords?.lng,
    zoom: coords ? 14 : 11,
    from: 'adm',
  });

  return {
    status: 200,
    payload: {
      parsed: {
        address,
        phone_digits: phoneDigits,
        items,
        customer_name: name,
      },
      geo: coords
        ? { lat: coords.lat, lng: coords.lng, radius_km: radiusKm, geocoded: true }
        : { lat: null, lng: null, radius_km: radiusKm, geocoded: false },
      summary: compared.summary,
      items_detail: itemsDetail,
      stores,
      mensagem,
      whatsapp_url: waUrl,
      mapa_lista_url: mapaUrl,
      used_fallback_national: Boolean(coords && filtered.length === 0 && rpcRows.length > 0),
      price_source: 'map',
    },
  };
}
