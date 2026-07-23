/**
 * POST /api/map/whatsapp-quote
 * B2C: lista + endereço → preços do mapa → logos/fotos → mensagem WhatsApp.
 */
import { createClient } from '@supabase/supabase-js';
import { geocodeAddress, GRANDE_SP_GEOCODE_BBOX, SAO_PAULO_CITY_PROXIMITY } from '../../../lib/geocode';
import { isSimulatedMapProductName } from '../../../lib/mapSimulatedOffers';
import { compareListWithMapOffers } from '../../../lib/shoppingListMapMatch';
import { getStoreLogoPinSrc } from '../../../lib/storeLogos';
import { resolveProductThumbnailUrl } from '../../../lib/mapProductImageCache';
import {
  parseWhatsappQuotePaste,
  filterRpcRowsByRadius,
  buildMapQuoteWhatsappMessage,
  normalizeWhatsAppDigitsLoose,
} from '../../../lib/whatsappQuote';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function resolveImagesBatch(supabase, names) {
  const unique = Array.from(
    new Set((names || []).map((n) => String(n || '').trim()).filter((n) => n.length >= 2))
  ).slice(0, 24);
  const out = new Map();
  const concurrency = 4;
  for (let i = 0; i < unique.length; i += concurrency) {
    const chunk = unique.slice(i, i + concurrency);
    const results = await Promise.all(
      chunk.map(async (name) => {
        try {
          const r = await resolveProductThumbnailUrl(supabase, name, '', { useGoogleCse: false });
          return [name, { url: r?.url || null, source: r?.source || null }];
        } catch {
          return [name, { url: null, source: null }];
        }
      })
    );
    for (const [name, r] of results) out.set(name, r);
  }
  return out;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error: 'Serviço indisponível' });

  const body = req.body || {};
  const pasted = String(body.text || body.paste || '').trim();
  const parsed = pasted
    ? parseWhatsappQuotePaste(pasted)
    : { address: null, phone_digits: null, items: [] };

  const address = String(body.address || parsed.address || '').trim() || null;
  const itemsRaw = Array.isArray(body.items) ? body.items : parsed.items;
  const items = itemsRaw
    .map((s) => String(s || '').trim())
    .filter((n) => n.length >= 2)
    .slice(0, 40);

  const phoneDigits =
    normalizeWhatsAppDigitsLoose(body.phone || body.telefone || '') ||
    parsed.phone_digits ||
    null;

  const radiusKm = Math.min(25, Math.max(2, Number(body.radius_km) || 8));
  const customerName = String(body.customer_name || body.nome || '').trim() || null;

  if (items.length === 0) {
    return res.status(400).json({
      error: 'Informe os produtos da lista (ou cole endereço + lista).',
      parsed,
    });
  }

  let coords = null;
  if (address) {
    coords = await geocodeAddress(address, {
      bbox: GRANDE_SP_GEOCODE_BBOX,
      proximity: SAO_PAULO_CITY_PROXIMITY,
    });
  }

  const { data: rpcRows, error: rpcErr } = await supabase.rpc('buscar_lojas_por_produtos_lista', {
    produtos: items,
  });

  if (rpcErr) {
    console.warn('[map/whatsapp-quote]', rpcErr.message);
    return res.status(500).json({ error: 'Não foi possível buscar preços no mapa.' });
  }

  const cleanRows = (rpcRows || []).filter((r) => !isSimulatedMapProductName(r.produto_nome));
  const filtered =
    coords?.lat != null
      ? filterRpcRowsByRadius(cleanRows, coords.lat, coords.lng, radiusKm)
      : cleanRows;

  const compared = compareListWithMapOffers(items, filtered.length ? filtered : cleanRows);

  const imageNames = [
    ...items,
    ...(compared.items || []).flatMap((it) =>
      [it.listName, it.bestOffer?.produto_nome].filter(Boolean)
    ),
  ];
  const imageMap = await resolveImagesBatch(supabase, imageNames);

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
    logo_url: getStoreLogoPinSrc(s.storeName),
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
    customerName,
    address,
    stores,
    items,
  });

  const waUrl = phoneDigits
    ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(mensagem)}`
    : `https://wa.me/?text=${encodeURIComponent(mensagem)}`;

  return res.status(200).json({
    parsed: {
      address,
      phone_digits: phoneDigits,
      items,
      customer_name: customerName,
    },
    geo: coords
      ? { lat: coords.lat, lng: coords.lng, radius_km: radiusKm, geocoded: true }
      : { lat: null, lng: null, radius_km: radiusKm, geocoded: false },
    summary: compared.summary,
    items_detail: itemsDetail,
    stores,
    mensagem,
    whatsapp_url: waUrl,
    used_fallback_national: Boolean(coords && filtered.length === 0 && cleanRows.length > 0),
    mapa_lista_url: `/mapa?lista=${encodeURIComponent(items.slice(0, 12).join(','))}`,
  });
}
