/**
 * POST /api/parceiros/adm/whatsapp-quote
 * Body: { text?, address?, items?, phone?, radius_km?, customer_name? }
 * Cola mensagem WhatsApp → geocode → preços do mapa → mensagem de resposta.
 */
import { requireAdmCompraApi } from '../../../../lib/adm/admCompra';
import { geocodePartnerStoreAddress } from '../../../../lib/geocode';
import { compareListWithMapOffers } from '../../../../lib/shoppingListMapCompare';
import {
  parseWhatsappQuotePaste,
  filterRpcRowsByRadius,
  buildMapQuoteWhatsappMessage,
  normalizeWhatsAppDigitsLoose,
} from '../../../../lib/adm/whatsappQuote';
import { getStoreBrandLogoUrl } from '../../../../lib/adm/storeBrandLogo';
import { resolveQuoteProductImagesBatch } from '../../../../lib/adm/resolveQuoteProductImage';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ctx = await requireAdmCompraApi(req, res);
  if (!ctx) return;
  const { supabase } = ctx;

  const body = req.body || {};
  const pasted = String(body.text || body.paste || '').trim();
  const parsed = pasted ? parseWhatsappQuotePaste(pasted) : { address: null, phone_digits: null, items: [] };

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
      error: 'Nenhum item de lista encontrado. Cole endereço + lista ou informe os produtos.',
      parsed,
    });
  }

  let coords = null;
  if (address) {
    coords = await geocodePartnerStoreAddress(address);
  }

  const { data: rpcRows, error: rpcErr } = await supabase.rpc('buscar_lojas_por_produtos_lista', {
    produtos: items,
  });

  if (rpcErr) {
    console.warn('[whatsapp-quote]', rpcErr.message);
    return res.status(500).json({ error: 'Não foi possível buscar preços no mapa.' });
  }

  const filtered =
    coords?.lat != null
      ? filterRpcRowsByRadius(rpcRows, coords.lat, coords.lng, radiusKm)
      : rpcRows || [];

  const compared = compareListWithMapOffers(items, filtered.length ? filtered : rpcRows || []);

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
        imageMap.get(l.listName) ||
        (l.productName ? imageMap.get(l.productName) : null);
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
    : null;

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
    used_fallback_national: Boolean(coords && filtered.length === 0 && (rpcRows || []).length > 0),
  });
}
