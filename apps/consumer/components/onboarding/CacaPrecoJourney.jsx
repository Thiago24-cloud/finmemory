'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { MascotImage } from '../gamification/MascotImage';
import { useMapCart } from '../map/MapCartContext';
import { getSupermercadoData, fetchStoreOffersFromApi } from '../../lib/mapStoreOffersCache';
import { CacaPrecoSpeechBubble } from './CacaPrecoSpeechBubble';
import { CacaPrecoWishBag } from './CacaPrecoWishBag';
import { CacaPrecoProductPicker } from './CacaPrecoProductPicker';
import {
  CACA_PRECO_SCENE_INTRO_TEXT,
  CACA_PRECO_SCENE_GPS_TEXT,
  CACA_PRECO_SCENE_META,
  CACA_PRECO_SCENE_READY_ROUTE_TEXT,
  cacaPrecoStoreFoundText,
} from '../../lib/onboarding/cacaPrecoJourneySteps';
import {
  isCacaPrecoJourneyDoneLocal,
  setCacaPrecoJourneyDoneLocal,
  shouldForceCacaPrecoJourney,
} from '../../lib/onboarding/cacaPrecoJourneyStorage';
import { isCacaPrecoMapJourneyCompleteInCoach } from '../../lib/onboarding/coachJourneyEngine';
import { setMapOnboardingDoneLocal } from '../../lib/onboarding/mapOnboardingStorage';
import {
  pickNearestStoreFromOfferRows,
  pickNearestStoreFromStoresList,
} from '../../lib/onboarding/nearestPartnerStore';

const GPS_TOUR_ID = 'map-gps-locate';

function setGpsHighlight(active) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('finmemory-caca-preco-highlight-gps', { detail: { active: Boolean(active) } })
  );
}

/**
 * Jornada gamificada de 5 cenas no mapa Caça-Preço.
 */
export function CacaPrecoJourney({ userId, userName, enabled = true }) {
  const router = useRouter();
  const { shoppingBag, toggleSelectedProduct } = useMapCart();
  const [active, setActive] = useState(false);
  const [scene, setScene] = useState('intro');
  const [nearestStore, setNearestStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const userPosRef = useRef(null);
  const introTimerRef = useRef(null);

  const forceReplay = shouldForceCacaPrecoJourney(router.query);

  useEffect(() => {
    if (!enabled || !userId) {
      setActive(false);
      return undefined;
    }
    if (!forceReplay && isCacaPrecoJourneyDoneLocal(userId)) {
      setActive(false);
      return undefined;
    }

    let cancelled = false;
    const boot = async () => {
      if (!forceReplay) {
        try {
          const res = await fetch('/api/user/coach-journey', { credentials: 'include' });
          if (res.ok && !cancelled) {
            const json = await res.json();
            if (isCacaPrecoMapJourneyCompleteInCoach(json.coach_journey)) {
              setCacaPrecoJourneyDoneLocal(userId);
              setActive(false);
              return;
            }
          }
        } catch {
          /* rede — localStorage como fallback */
        }
      }
      if (!cancelled) {
        window.setTimeout(() => {
          if (!cancelled) setActive(true);
        }, 600);
      }
    };
    void boot();
    return () => {
      cancelled = true;
    };
  }, [enabled, userId, forceReplay]);

  const bubbleText = useMemo(() => {
    switch (scene) {
      case 'intro':
        return CACA_PRECO_SCENE_INTRO_TEXT;
      case 'gps_cta':
        return CACA_PRECO_SCENE_GPS_TEXT;
      case 'store_found':
        return cacaPrecoStoreFoundText({
          userName,
          storeName: nearestStore?.storeName,
        });
      case 'pick_products':
        return cacaPrecoStoreFoundText({
          userName,
          storeName: nearestStore?.storeName,
        });
      case 'ready_route':
        return CACA_PRECO_SCENE_READY_ROUTE_TEXT;
      default:
        return '';
    }
  }, [scene, userName, nearestStore?.storeName]);

  const selectedIds = useMemo(
    () => new Set(shoppingBag.map((x) => String(x.offerId || x.id))),
    [shoppingBag]
  );

  const goScene = useCallback((next) => {
    setScene(next);
    setGpsHighlight(next === 'gps_cta');
  }, []);

  useEffect(() => {
    if (!active || scene !== 'intro') return undefined;
    const ms = CACA_PRECO_SCENE_META.intro.autoAdvanceMs ?? 4500;
    introTimerRef.current = window.setTimeout(() => goScene('gps_cta'), ms);
    return () => {
      if (introTimerRef.current) window.clearTimeout(introTimerRef.current);
    };
  }, [active, scene, goScene]);

  useEffect(() => {
    if (!active) {
      setGpsHighlight(false);
      return undefined;
    }
    setGpsHighlight(scene === 'gps_cta');
    return () => setGpsHighlight(false);
  }, [active, scene]);

  const resolveNearestStore = useCallback(async (lat, lng) => {
    const params = new URLSearchParams({
      lat: String(lat),
      lng: String(lng),
      radius: '8000',
    });
    let store = null;
    try {
      const storesRes = await fetch(`/api/map/stores?${params}`);
      const storesJson = await storesRes.json().catch(() => ({}));
      if (storesRes.ok && Array.isArray(storesJson.stores)) {
        store = pickNearestStoreFromStoresList(lat, lng, storesJson.stores);
      }
    } catch {
      /* ignore */
    }
    try {
      const offerParams = new URLSearchParams({
        lat: String(lat),
        lng: String(lng),
        raio_km: '8',
      });
      const offerRes = await fetch(`/api/map/produtos-proximos?${offerParams}`);
      const offerJson = await offerRes.json().catch(() => ({}));
      if (offerRes.ok && Array.isArray(offerJson.items)) {
        const fromOffers = pickNearestStoreFromOfferRows(lat, lng, offerJson.items);
        if (fromOffers && (!store || fromOffers.distanceM < store.distanceM)) {
          store = fromOffers;
        }
      }
    } catch {
      /* ignore */
    }
    return store;
  }, []);

  const loadStoreProducts = useCallback(async (store) => {
    if (!store?.storeId) return [];
    setProductsLoading(true);
    try {
      const storeId = store.storeId;
      const result = await getSupermercadoData({
        storeId,
        fetchFresh: () => fetchStoreOffersFromApi(storeId),
      });
      const data = result.data;
      const offers = (data.offers || []).map((o) => ({
        id: String(o.id),
        productName: o.product_name || o.name,
        name: o.product_name || o.name,
        priceNum: Number(o.promo_price ?? o.price ?? o.club_price) || null,
        precoLabel: o.price_label || null,
        store_id: store.storeId,
        store_lat: store.lat,
        store_lng: store.lng,
      }));
      const promos = (data?.promotions || []).map((p, i) => ({
        id: `encarte-${p.id || i}`,
        productName: p.title || p.product_name || 'Promoção',
        name: p.title || p.product_name,
        priceNum: null,
        precoLabel: null,
        store_id: store.storeId,
      }));
      return offers.length > 0 ? offers.slice(0, 12) : promos.slice(0, 8);
    } catch {
      return [];
    } finally {
      setProductsLoading(false);
    }
  }, []);

  const onLocationFound = useCallback(
    async (e) => {
      const lat = Number(e?.detail?.lat);
      const lng = Number(e?.detail?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      if (scene !== 'gps_cta' && scene !== 'intro') return;

      userPosRef.current = { lat, lng };
      setGpsHighlight(false);

      const store = await resolveNearestStore(lat, lng);
      setNearestStore(store);

      if (store?.storeId && Number.isFinite(store.lat) && Number.isFinite(store.lng)) {
        window.dispatchEvent(
          new CustomEvent('finmemory-caca-preco-focus-store', {
            detail: {
              storeId: store.storeId,
              lat: store.lat,
              lng: store.lng,
              storeName: store.storeName,
            },
          })
        );
      }

      goScene('store_found');

      let list = store ? await loadStoreProducts(store) : [];
      if (list.length === 0 && store) {
        try {
          const offerParams = new URLSearchParams({
            lat: String(lat),
            lng: String(lng),
            raio_km: '8',
          });
          const offerRes = await fetch(`/api/map/produtos-proximos?${offerParams}`);
          const offerJson = await offerRes.json().catch(() => ({}));
          const storeKey = String(store.storeId || store.storeName || '').toLowerCase();
          list = (offerJson.items || [])
            .filter((row) => {
              if (store.storeId && row.loja_id != null) {
                return String(row.loja_id) === String(store.storeId);
              }
              const name = String(row.nome_comercial || '').toLowerCase();
              return storeKey && name.includes(storeKey) || name === storeKey;
            })
            .slice(0, 12)
            .map((row) => ({
              id: `merchant-pl-${row.produto_id}`,
              productName: row.nome_produto || row.nome_comercial,
              name: row.nome_produto || row.nome_comercial,
              priceNum: Number(row.preco_oferta) || null,
              store_id: row.loja_id,
            }));
        } catch {
          /* ignore */
        }
      }
      setProducts(list);
      if (list.length === 0) {
        window.setTimeout(() => goScene('ready_route'), 1800);
      } else {
        window.setTimeout(() => goScene('pick_products'), 2200);
      }
    },
    [scene, resolveNearestStore, loadStoreProducts, goScene]
  );

  useEffect(() => {
    if (!active) return undefined;
    window.addEventListener('finmemory-map-user-location', onLocationFound);
    return () => window.removeEventListener('finmemory-map-user-location', onLocationFound);
  }, [active, onLocationFound]);

  const handleBubbleTap = useCallback(() => {
    if (scene === 'intro') {
      if (introTimerRef.current) window.clearTimeout(introTimerRef.current);
      goScene('gps_cta');
    }
  }, [scene, goScene]);

  const handleToggleProduct = useCallback(
    (p) => {
      const storeLabel = nearestStore?.storeName || 'Loja';
      toggleSelectedProduct({
        id: p.id,
        offerId: p.id,
        name: p.productName || p.name,
        productName: p.productName || p.name,
        priceNum: p.priceNum,
        storeId: nearestStore?.storeId || p.store_id,
        storeLabel,
        storeName: storeLabel,
        storeGeo:
          Number.isFinite(Number(nearestStore?.lat)) && Number.isFinite(Number(nearestStore?.lng))
            ? { lat: Number(nearestStore.lat), lng: Number(nearestStore.lng) }
            : null,
      });
    },
    [nearestStore, toggleSelectedProduct]
  );

  const handleFinishList = useCallback(() => {
    goScene('ready_route');
  }, [goScene]);

  const completeJourney = useCallback(() => {
    if (userId) {
      setCacaPrecoJourneyDoneLocal(userId);
      setMapOnboardingDoneLocal(userId);
    }
    try {
      fetch('/api/user/coach-journey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'complete_caca_preco_map' }),
      }).catch(() => {});
    } catch {
      /* ignore */
    }
    setActive(false);
    setGpsHighlight(false);
  }, [userId]);

  const handleStartRoute = useCallback(() => {
    window.dispatchEvent(new CustomEvent('finmemory-caca-preco-start-route'));
    completeJourney();
  }, [completeJourney]);

  const showMascotRow =
    active && ['intro', 'gps_cta', 'store_found', 'pick_products', 'ready_route'].includes(scene);
  const showPicker = active && scene === 'pick_products' && products.length > 0 && !productsLoading;
  const showBag =
    active && (scene === 'pick_products' || scene === 'ready_route') && shoppingBag.length > 0;

  if (!active) return null;

  return (
    <>
      {showBag ? <CacaPrecoWishBag items={shoppingBag} /> : null}
      {showPicker ? (
        <CacaPrecoProductPicker
          products={products}
          selectedIds={selectedIds}
          onToggleProduct={handleToggleProduct}
          onFinishList={handleFinishList}
          minItemsToFinish={1}
        />
      ) : null}

      {showMascotRow ? (
        <div
          className="pointer-events-none fixed left-0 right-0 z-[56] px-3 sm:px-4"
          style={{
            bottom: 'calc(5.25rem + env(safe-area-inset-bottom, 0px))',
            maxWidth: '42rem',
            margin: '0 auto',
          }}
          role="presentation"
        >
          <div className="pointer-events-auto flex flex-row items-end gap-2 sm:gap-3">
            <div className="shrink-0 -mb-1 w-[72px] sm:w-[88px]">
              <MascotImage width={88} className="drop-shadow-lg" />
            </div>
            <CacaPrecoSpeechBubble
              text={bubbleText}
              onTap={scene === 'intro' ? handleBubbleTap : undefined}
            />
          </div>
        </div>
      ) : null}

      {active && scene === 'ready_route' ? (
        <div
          className="pointer-events-none fixed left-3 right-3 z-[58] mx-auto max-w-md"
          style={{ bottom: 'calc(13.5rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <button
            type="button"
            onClick={handleStartRoute}
            className="pointer-events-auto w-full rounded-2xl border-2 border-black bg-gradient-to-r from-emerald-400 to-emerald-500 py-3.5 text-base font-extrabold text-[#052e16] shadow-[0_10px_24px_rgba(16,185,129,0.45)] animate-pulse motion-reduce:animate-none"
          >
            Iniciar Rota
          </button>
        </div>
      ) : null}
    </>
  );
}
