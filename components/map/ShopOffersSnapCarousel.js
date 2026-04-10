import { useCallback, useEffect, useRef, useState } from 'react';
import { getMapProductImageSrcForImg } from '../../lib/mapImageProxy';

const CARD_W = 160;
const GAP = 10;

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

function categoryFallbackGlyph(category) {
  const c = String(category || '').toLowerCase();
  if (c.includes('bebida')) return '🥤';
  if (c.includes('padar')) return '🥖';
  return '🛒';
}

function formatBRLPriceNum(n) {
  return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Carrossel horizontal com scroll-snap (estilo Google Maps expandido).
 * @param {object} p
 * @param {Array<{ id: string, product_name?: string, price?: unknown, category?: string, promo_image_url?: string }>} p.offers
 * @param {boolean} p.wazeUi
 * @param {(offer: object) => React.ReactNode} [p.formatPriceSlot]
 */
export default function ShopOffersSnapCarousel({ offers, wazeUi, formatPriceSlot }) {
  const scrollerRef = useRef(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const n = offers.length;

  const scrollToIndex = useCallback((i) => {
    const el = scrollerRef.current;
    if (!el || n === 0) return;
    const idx = Math.max(0, Math.min(i, n - 1));
    el.scrollTo({ left: idx * (CARD_W + GAP), behavior: 'smooth' });
    setActiveIdx(idx);
  }, [n]);

  const onScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el || n === 0) return;
    const step = CARD_W + GAP;
    const i = Math.round(el.scrollLeft / step);
    setActiveIdx(Math.min(Math.max(0, i), n - 1));
  }, [n]);

  useEffect(() => {
    setActiveIdx(0);
    if (scrollerRef.current) scrollerRef.current.scrollTo({ left: 0 });
  }, [offers]);

  if (!n) return null;

  return (
    <div className="mb-3 w-full">
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className={`flex w-full gap-2.5 overflow-x-auto overflow-y-hidden px-1 pb-1 ${
          wazeUi ? 'finmemory-waze-scroll' : ''
        }`}
        style={{
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'thin',
          touchAction: 'pan-x',
        }}
      >
        {offers.map((offer) => {
          const url = offer.promo_image_url;
          const imgOk = url && isDisplayableImageUrl(url);
          const imgSrc = imgOk ? getMapProductImageSrcForImg(url) : '';
          const name = String(offer.product_name || 'Produto').slice(0, 80);
          const priceNode = formatPriceSlot ? (
            formatPriceSlot(offer)
          ) : offer.price != null && Number(offer.price) > 0 ? (
            <p
              className={`mt-auto text-sm font-bold tabular-nums ${wazeUi ? 'text-[#2ecc71]' : 'text-emerald-600'}`}
            >
              R$ {formatBRLPriceNum(offer.price)}
            </p>
          ) : (
            <p className={`mt-auto text-[11px] ${wazeUi ? 'text-[#888]' : 'text-gray-500'}`}>Ver na loja</p>
          );

          return (
            <article
              key={String(offer.id)}
              className={`flex h-[200px] w-[160px] min-w-[160px] shrink-0 snap-start flex-col overflow-hidden rounded-xl border shadow-sm ${
                wazeUi ? 'border-[#2a2d3a] bg-[#1a1d27]' : 'border-gray-200 bg-white'
              }`}
              style={{ scrollSnapAlign: 'start' }}
            >
              <div
                className={`relative h-[120px] w-full shrink-0 overflow-hidden ${
                  wazeUi ? 'bg-[#161922]' : 'bg-gray-100'
                }`}
              >
                {imgOk ? (
                  <img
                    src={imgSrc || url}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-4xl">
                    {categoryFallbackGlyph(offer.category)}
                  </div>
                )}
              </div>
              <div className={`flex min-h-0 flex-1 flex-col p-2 ${wazeUi ? 'text-[#f0f0f0]' : 'text-gray-900'}`}>
                <p className="line-clamp-2 text-left text-[11px] font-semibold leading-snug" title={name}>
                  {name}
                </p>
                <div className="mt-1 min-h-0 flex-1">{priceNode}</div>
              </div>
            </article>
          );
        })}
      </div>
      {n > 1 ? (
        <div className="mt-1 flex justify-center gap-1.5 px-2">
          {offers.map((o, i) => (
            <button
              key={`dot-${o.id}`}
              type="button"
              aria-label={`Oferta ${i + 1}`}
              aria-current={i === activeIdx ? 'true' : undefined}
              className={`h-1.5 rounded-full transition-all ${
                i === activeIdx
                  ? wazeUi
                    ? 'w-5 bg-[#2ecc71]'
                    : 'w-5 bg-[#2ECC49]'
                  : wazeUi
                    ? 'w-1.5 bg-[#3d424d] hover:bg-[#555]'
                    : 'w-1.5 bg-gray-300 hover:bg-gray-400'
              }`}
              onClick={() => scrollToIndex(i)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
