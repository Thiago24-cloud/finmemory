'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Clock, Globe, Loader2, MapPin, Navigation, Phone, Search, ShoppingCart, X } from 'lucide-react';
import {
  openGoogleMapsDirectionsPreferCurrentLocation,
  openGoogleMapsSearchQuery,
  openWazeSearchByAddress,
} from '../../lib/mapDirections';
import { getMapProductImageSrcForImg } from '../../lib/mapImageProxy';
import { displayPromoProductName, promoCategoryBadgeLabel } from '../../lib/mapOfferDisplay';
import { getMapOfferSeenPresentation } from '../../lib/mapOfferSeenLabel';

function storeTypeLabelForSheet(type) {
  if (!type) return 'Comércio';
  const t = String(type).toLowerCase();
  if (t === 'supermarket') return 'Supermercado';
  if (t === 'pharmacy') return 'Farmácia';
  if (t === 'bakery') return 'Padaria';
  if (t === 'restaurant') return 'Restaurante';
  return 'Comércio';
}

function isDisplayableImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return false;
  const u = trimmed.toLowerCase();
  if (/\.(webp|jpg|jpeg|png|gif|avif)(\?|#|$|&)/i.test(u)) return true;
  if (
    /imgur|cloudinary|imgix|supabase.*\/storage|googleusercontent|gpa\.digital|dia\.com\.br|cdn|akamai|cloudfront/i.test(
      u
    )
  ) {
    return true;
  }
  return /^https?:\/\//i.test(u) && !/\.(pdf|zip)(\?|$)/i.test(u);
}

function normalizeWebsiteUrl(w) {
  const s = String(w || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

const CARD_W = 160;
const CARD_GAP = 10;

const ShopOfferSnapCard = memo(function ShopOfferSnapCard({
  offer,
  storeNameHint,
  wazeUi,
  formatPriceLabel,
  selected,
  onToggle,
  seenPresentation,
  canConfirmPrice,
  confirmBusy,
  onConfirmPrice,
}) {
  const url = offer.promo_image_url;
  const imgOk = url && isDisplayableImageUrl(url);
  const imgSrc = imgOk ? getMapProductImageSrcForImg(url) : '';
  const [imgLoaded, setImgLoaded] = useState(false);
  useEffect(() => {
    setImgLoaded(false);
  }, [imgSrc, url]);
  const hint = storeNameHint || offer.store_name || '';
  const name = String(displayPromoProductName(offer.product_name, hint) || 'Produto').slice(0, 80);
  const priceNode = formatPriceLabel(offer);
  const cat = promoCategoryBadgeLabel(offer.category);

  return (
    <article
      className={`flex w-[160px] min-w-[160px] shrink-0 snap-start flex-col overflow-hidden rounded-xl border bg-white ${
        wazeUi ? 'border-[#2a2d3a] bg-[#1a1d27]' : 'border-[#eee]'
      }`}
      style={{ scrollSnapAlign: 'start' }}
    >
      <div
        className={`relative aspect-square w-full shrink-0 overflow-hidden ${
          wazeUi ? 'bg-[#161922]' : 'bg-gray-100'
        }`}
      >
        {imgOk ? (
          <>
            <div
              className={`absolute inset-0 animate-pulse ${wazeUi ? 'bg-[#252a38]' : 'bg-gray-200'} ${
                imgLoaded ? 'pointer-events-none opacity-0' : 'opacity-100'
              } transition-opacity duration-200`}
              aria-hidden
            />
            <img
              src={imgSrc || url}
              alt=""
              className={`relative z-[1] h-full w-full object-cover transition-opacity duration-200 ${
                imgLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              loading="lazy"
              decoding="async"
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgLoaded(true)}
            />
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-emerald-600/90">
            <ShoppingCart className="h-10 w-10 text-white/90" aria-hidden />
          </div>
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 p-1.5">
        {cat ? (
          <span
            className={`inline-block max-w-full self-start rounded px-1 py-0.5 text-[9px] font-medium ${
              wazeUi ? 'bg-[#2a2d3a] text-[#aaa]' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {cat}
          </span>
        ) : null}
        <p
          className={`line-clamp-2 text-[11px] font-semibold leading-snug ${
            wazeUi ? 'text-[#e8e8e8]' : 'text-gray-900'
          }`}
        >
          {name}
        </p>
        <div
          className={`text-[13px] font-bold tabular-nums leading-none ${wazeUi ? 'text-[#2ecc71]' : 'text-emerald-600'}`}
        >
          {priceNode}
        </div>
        {seenPresentation?.text ? (
          <div
            className={`flex items-center gap-0.5 text-[9px] font-medium leading-tight ${seenPresentation.className}`}
          >
            <Clock className={`h-2.5 w-2.5 shrink-0 ${seenPresentation.iconClassName}`} aria-hidden />
            <span>{seenPresentation.text}</span>
          </div>
        ) : null}
        {canConfirmPrice && onConfirmPrice ? (
          <button
            type="button"
            data-sheet-no-tap-expand
            disabled={confirmBusy}
            className={`mt-0.5 w-full rounded-md border py-1 text-[9px] font-semibold transition-colors disabled:opacity-50 ${
              wazeUi
                ? 'border-[#2a2d3a] bg-[#161922] text-[#9aa0a6] hover:border-[#2ecc71] hover:text-[#2ecc71]'
                : 'border-gray-200 bg-white text-gray-600 hover:border-emerald-400 hover:text-emerald-700'
            }`}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onConfirmPrice(offer);
            }}
          >
            {confirmBusy ? '…' : 'Preço ok na loja'}
          </button>
        ) : null}
        <button
          type="button"
          data-sheet-no-tap-expand
          className={`mt-auto w-full rounded-lg py-1.5 text-[11px] font-semibold text-white ${
            wazeUi ? 'bg-[#2ecc71] text-[#0f1117]' : 'bg-[#2ECC49]'
          }`}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(offer);
          }}
        >
          {selected ? '✓ Na cesta' : '+ Cesta'}
        </button>
      </div>
    </article>
  );
});

/**
 * Conteúdo expandido do bottom sheet da loja (mobile) — layout estilo Google Maps.
 */
export default function MapShopMobileGoogleSheetBody({
  shopStore,
  shopLoading,
  shopErr,
  wazeUi,
  userOrigin,
  carouselOffers,
  promoCount,
  cartOfferIdSet,
  toggleCartOffer,
  formatOfferPrice,
  onRequestClose,
  wazeCategoryChips,
  encarteSection,
  sharePriceHref,
  hasEncartePromotions,
  canConfirmPrice = false,
  onOfferConfirmed,
  confirmBusyOfferId = null,
}) {
  const scrollerRef = useRef(null);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [sheetQuery, setSheetQuery] = useState('');

  const filteredCarousel = useMemo(() => {
    const t = sheetQuery.trim().toLowerCase();
    if (!t) return carouselOffers;
    return carouselOffers.filter((o) => {
      const name = String(o.product_name || '').toLowerCase();
      const cat = String(o.category || '').toLowerCase();
      return name.includes(t) || cat.includes(t);
    });
  }, [carouselOffers, sheetQuery]);

  const nCarousel = filteredCarousel.length;

  const heroSrc = useMemo(() => {
    const pu = shopStore?.photo_url;
    if (pu && String(pu).trim()) return String(pu).trim();
    for (const o of carouselOffers) {
      const u = o?.promo_image_url;
      if (u && isDisplayableImageUrl(u)) return getMapProductImageSrcForImg(u) || u;
    }
    return null;
  }, [shopStore, carouselOffers]);

  const addressLine = useMemo(() => {
    const parts = [
      shopStore?.address,
      shopStore?.neighborhood,
    ].filter(Boolean);
    return parts.join(' · ') || '';
  }, [shopStore]);

  const websiteUrl = useMemo(() => {
    const w = shopStore?.website || shopStore?.promo_page_url;
    return w ? normalizeWebsiteUrl(w) : '';
  }, [shopStore]);

  const phoneRaw = shopStore?.phone ? String(shopStore.phone).trim() : '';
  const phoneTel = phoneRaw ? `tel:${phoneRaw.replace(/\s/g, '')}` : '';

  const lat = Number(shopStore?.lat);
  const lng = Number(shopStore?.lng);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  const dest = hasCoords ? { lat, lng } : null;

  const onScrollCarousel = useCallback(() => {
    const el = scrollerRef.current;
    if (!el || nCarousel === 0) return;
    const step = CARD_W + CARD_GAP;
    const i = Math.round(el.scrollLeft / step);
    setCarouselIdx(Math.min(Math.max(0, i), nCarousel - 1));
  }, [nCarousel]);

  useEffect(() => {
    setCarouselIdx(0);
    const el = scrollerRef.current;
    if (el) el.scrollLeft = 0;
  }, [sheetQuery]);

  const pillBase =
    'inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-[20px] border border-gray-300 bg-white px-3.5 text-xs font-semibold text-gray-800 shadow-sm active:scale-[0.98]';
  const pillWaze = wazeUi
    ? 'inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-[20px] border border-[#2a2d3a] bg-[#1a1d27] px-3.5 text-xs font-semibold text-[#e5e5e5] shadow-sm active:scale-[0.98]'
    : pillBase;

  const hoursText =
    shopStore?.weekday_hours && String(shopStore.weekday_hours).trim()
      ? String(shopStore.weekday_hours).trim()
      : 'Consulte o horário da loja.';

  return (
    <div className={wazeUi ? 'text-[#e8e8e8]' : 'text-gray-900'}>
      <div className="relative h-[200px] w-full shrink-0 overflow-hidden bg-emerald-600">
        {heroSrc ? (
          <img src={heroSrc} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-emerald-600 to-emerald-800">
            <ShoppingCart className="h-14 w-14 text-white/85" aria-hidden />
          </div>
        )}
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent"
          aria-hidden
        />
        <button
          type="button"
          data-sheet-no-drag
          className="absolute right-2 top-2 z-[2] flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-gray-800 shadow-md"
          aria-label="Fechar"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onRequestClose}
        >
          <X className="h-5 w-5" />
        </button>
        <div className="absolute bottom-0 left-0 right-0 z-[1] px-4 pb-3 pt-8">
          {shopLoading ? (
            <div className="flex items-center gap-2 text-white">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              <span className="text-sm">A carregar…</span>
            </div>
          ) : (
            <>
              <h2 className="text-[20px] font-bold leading-tight text-white drop-shadow-sm">
                {shopStore?.name || 'Loja'}
              </h2>
              <p className="mt-0.5 text-[13px] text-white/70">{storeTypeLabelForSheet(shopStore?.type)}</p>
              <p className="mt-1 max-w-[95%] text-[11px] font-medium leading-snug text-white/90 drop-shadow-sm line-clamp-2">
                Nossa loja te espera — veja as ofertas e compare com calma.
              </p>
              <span className="mt-2 inline-block rounded-full bg-emerald-500 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
                {promoCount} oferta{promoCount === 1 ? '' : 's'} ativa{promoCount === 1 ? '' : 's'}
              </span>
            </>
          )}
        </div>
      </div>

      {shopErr ? (
        <p className={`px-4 py-3 text-sm ${wazeUi ? 'text-red-400' : 'text-red-600'}`}>{shopErr}</p>
      ) : null}

      {hasCoords ? (
        <div
          className="flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x' }}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className={
              wazeUi
                ? 'inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-[20px] bg-[#1a73e8] px-3.5 text-xs font-semibold text-white shadow-sm'
                : 'inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-[20px] bg-[#1a73e8] px-3.5 text-xs font-semibold text-white shadow-sm'
            }
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              openGoogleMapsDirectionsPreferCurrentLocation(dest, userOrigin);
            }}
          >
            <Navigation className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
            Rotas
          </button>
          <button
            type="button"
            className={pillWaze}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              if (addressLine) openWazeSearchByAddress(addressLine);
              else openWazeSearchByAddress(`${lat},${lng}`);
            }}
          >
            ▶ Waze
          </button>
          {websiteUrl ? (
            <a
              href={websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={pillWaze}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <Globe className="h-4 w-4 shrink-0" aria-hidden />
              Site
            </a>
          ) : null}
          {phoneTel ? (
            <a href={phoneTel} className={pillWaze} onMouseDown={(e) => e.stopPropagation()}>
              <Phone className="h-4 w-4 shrink-0" aria-hidden />
              Ligar
            </a>
          ) : null}
        </div>
      ) : null}

      {wazeCategoryChips || carouselOffers.length > 0 ? (
        <div className="sticky top-0 z-[5]">
          {wazeCategoryChips ? (
            <div
              className={`border-b ${
                wazeUi
                  ? 'border-[#1e2130] bg-[#13161f]/72 shadow-[0_6px_20px_rgba(0,0,0,0.22)] supports-[backdrop-filter]:bg-[#13161f]/48 backdrop-blur-xl backdrop-saturate-150'
                  : 'border-gray-200/90 bg-white/72 shadow-[0_6px_18px_rgba(15,23,42,0.08)] supports-[backdrop-filter]:bg-white/48 backdrop-blur-xl backdrop-saturate-150'
              }`}
              data-sheet-no-drag
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              {wazeCategoryChips}
            </div>
          ) : null}
          {carouselOffers.length > 0 ? (
            <div
              className={`border-b px-4 py-2 ${
                wazeUi ? 'border-[#1e2130] bg-[#13161f]' : 'border-gray-100 bg-white'
              }`}
              data-sheet-no-drag
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              <label className="sr-only" htmlFor="finmemory-shop-sheet-search">
                Pesquisar ofertas nesta loja
              </label>
              <div
                className={`flex items-center gap-2 rounded-full border px-3 py-2 ${
                  wazeUi ? 'border-[#2a2d3a] bg-[#1a1d27]' : 'border-gray-200 bg-white'
                }`}
              >
                <Search className={`h-4 w-4 shrink-0 ${wazeUi ? 'text-[#9aa0a6]' : 'text-gray-400'}`} aria-hidden />
                <input
                  id="finmemory-shop-sheet-search"
                  type="search"
                  enterKeyHint="search"
                  value={sheetQuery}
                  onChange={(e) => setSheetQuery(e.target.value)}
                  placeholder={`Pesquisar em ${shopStore?.name || 'esta loja'}…`}
                  className={`min-w-0 flex-1 border-0 bg-transparent text-[13px] outline-none focus:ring-0 ${
                    wazeUi ? 'text-[#e8eaed] placeholder:text-[#6b7280]' : 'text-gray-900 placeholder:text-gray-400'
                  }`}
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {nCarousel > 0 ? (
        <div className="pt-1">
          <div
            ref={scrollerRef}
            onScroll={onScrollCarousel}
            className="flex gap-[10px] overflow-x-auto px-4 py-3"
            style={{
              scrollSnapType: 'x mandatory',
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-x',
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {filteredCarousel.map((offer) => (
              <ShopOfferSnapCard
                key={String(offer.id)}
                offer={offer}
                storeNameHint={shopStore?.name}
                wazeUi={wazeUi}
                formatPriceLabel={formatOfferPrice}
                selected={cartOfferIdSet.has(String(offer.id))}
                onToggle={toggleCartOffer}
                seenPresentation={getMapOfferSeenPresentation(offer.observed_at)}
                canConfirmPrice={canConfirmPrice}
                confirmBusy={confirmBusyOfferId === String(offer.id)}
                onConfirmPrice={onOfferConfirmed}
              />
            ))}
          </div>
          <p
            className={`px-4 pb-2 text-center text-[11px] ${wazeUi ? 'text-[#666]' : 'text-gray-500'}`}
          >
            {carouselIdx + 1} de {nCarousel}
            {sheetQuery.trim() ? ` · filtrado` : ''} →
          </p>
        </div>
      ) : carouselOffers.length > 0 && sheetQuery.trim() ? (
        <p className={`px-4 py-3 text-center text-sm ${wazeUi ? 'text-[#888]' : 'text-gray-600'}`}>
          Nenhum produto corresponde a “{sheetQuery.trim()}”.
        </p>
      ) : !shopLoading && !shopErr && !hasEncartePromotions ? (
        <p className={`px-4 py-4 text-center text-sm ${wazeUi ? 'text-[#888]' : 'text-gray-600'}`}>
          Nenhuma promoção encontrada para esta loja nesta região.
        </p>
      ) : !shopLoading && !shopErr && hasEncartePromotions && carouselOffers.length === 0 ? (
        <p className={`px-4 pb-2 text-center text-[11px] ${wazeUi ? 'text-[#666]' : 'text-gray-500'}`}>
          Sem ofertas de prateleira no mapa; veja os encartes abaixo.
        </p>
      ) : null}

      {encarteSection}

      <div className={`mx-4 mb-3 divide-y rounded-xl border ${wazeUi ? 'border-[#2a2d3a] bg-[#161922]' : 'border-gray-200 bg-gray-50'}`}>
        <div className="flex gap-3 px-3 py-3">
          <Clock className={`mt-0.5 h-5 w-5 shrink-0 ${wazeUi ? 'text-[#888]' : 'text-gray-500'}`} aria-hidden />
          <div className="min-w-0">
            <p className={`text-sm font-medium ${wazeUi ? 'text-[#2ecc71]' : 'text-emerald-700'}`}>Horário</p>
            <p className={`text-sm ${wazeUi ? 'text-[#ccc]' : 'text-gray-800'}`}>{hoursText}</p>
          </div>
        </div>
        {addressLine ? (
          <button
            type="button"
            className="flex w-full gap-3 px-3 py-3 text-left"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              openGoogleMapsSearchQuery(addressLine);
            }}
          >
            <MapPin className={`mt-0.5 h-5 w-5 shrink-0 ${wazeUi ? 'text-[#888]' : 'text-gray-500'}`} aria-hidden />
            <div className="min-w-0">
              <p className={`text-sm font-medium ${wazeUi ? 'text-[#e0e0e0]' : 'text-gray-900'}`}>Endereço</p>
              <p className={`text-sm ${wazeUi ? 'text-[#aaa]' : 'text-gray-600'}`}>{addressLine}</p>
            </div>
          </button>
        ) : null}
        {websiteUrl ? (
          <a
            href={websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex gap-3 px-3 py-3 no-underline"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <Globe className={`mt-0.5 h-5 w-5 shrink-0 ${wazeUi ? 'text-[#888]' : 'text-gray-500'}`} aria-hidden />
            <div className="min-w-0">
              <p className={`text-sm font-medium ${wazeUi ? 'text-[#e0e0e0]' : 'text-gray-900'}`}>Site</p>
              <p className={`truncate text-sm ${wazeUi ? 'text-[#6ab7ff]' : 'text-[#1a73e8]'}`}>
                {shopStore?.website || shopStore?.promo_page_url}
              </p>
            </div>
          </a>
        ) : null}
      </div>

      <div
        className={`mx-4 mb-6 rounded-xl border px-3 py-3 ${
          wazeUi ? 'border-[#1e3a5f] bg-[#152238]' : 'border-sky-200 bg-sky-50'
        }`}
      >
        <p className={`text-sm font-semibold ${wazeUi ? 'text-[#93c5fd]' : 'text-sky-900'}`}>
          Qual ou quais produtos você queria mas acabou o estoque?
        </p>
        <p className={`mt-1 text-xs ${wazeUi ? 'text-[#9ca3af]' : 'text-sky-800'}`}>
          Quais produtos você gostaria de ter na loja →
        </p>
        <Link
          href={sharePriceHref}
          className={`mt-3 inline-block rounded-lg px-3 py-2 text-xs font-semibold no-underline ${
            wazeUi ? 'bg-[#3b82f6] text-white' : 'bg-sky-600 text-white'
          }`}
          onMouseDown={(e) => e.stopPropagation()}
        >
          Enviar sugestão
        </Link>
      </div>
    </div>
  );
}
