'use client';

import { MapContainer, TileLayer, Marker, Popup, Tooltip, Polyline, useMap } from 'react-leaflet';
import { displayPromoProductName, promoCategoryBadgeLabel, promoShelfLabel } from '../lib/mapOfferDisplay';
import { useEffect, useLayoutEffect, useState, useCallback, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ShoppingCart, Loader2, Check, X, Navigation, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { openGoogleMapsDirectionsPreferCurrentLocation, openWazeNavigation } from '../lib/mapDirections';
import { getMapThemeById, getCategoryColor, getStorePinMainColor, MAP_THEMES } from '../lib/colors';
import { trackBackendEvent, trackEvent } from '../lib/analytics';
import { SAO_PAULO_STATE_CENTER, SAO_PAULO_STATE_ZOOM } from '../lib/saoPauloStateMap';
import { getSupabase } from '../lib/supabase';
import { parsePriceToNumber } from '../lib/parseMapPrice';
import { getMapOfferSeenPresentation } from '../lib/mapOfferSeenLabel';
import { getMapProductImageSrcForImg } from '../lib/mapImageProxy';
import { useMatchMedia } from '../lib/useMatchMedia';
import { isClientUsablePinLogoRef } from '../lib/mapPinLogoUrl';
import { getHomogeneousGroupLogoPinSrc, getStoreLogoPinSrc } from '../lib/storeLogos';
import { scheduleMissionFollowupNotification } from '../lib/missionFollowupNotification';
import MapMobileBottomSheet from './map/MapMobileBottomSheet';
import EstablishmentDetailSheet from './map/EstablishmentDetailSheet';
import FloatingCartBar from './map/FloatingCartBar';
import { useMapCart } from './map/MapCartContext';
import { useBagBackgroundMonitoring } from './map/useBagBackgroundMonitoring';
import { MapBottomPaddingSync } from './map/MapBottomPaddingSync';
import {
  getMapPinOpenAirLabelStyle,
  mixWithWhite,
  readableAccentOnLightChip,
} from '../lib/mapPinVisual';

/** Vista inicial: Estado de São Paulo (zoom out); o utilizador aproxima para bairro/cidade. */
const DEFAULT_MAP_CENTER = Object.freeze([...SAO_PAULO_STATE_CENTER]);
const DEFAULT_MAP_ZOOM = SAO_PAULO_STATE_ZOOM;

/** Com zoom baixo, esconder nomes ao lado dos pins (menos poluição, como no Google Maps). Busca ativa mostra nomes. */
const MAP_LABEL_MIN_ZOOM = 15;

function useMapZoom() {
  const map = useMap();
  const [zoom, setZoom] = useState(DEFAULT_MAP_ZOOM);
  useEffect(() => {
    if (!map) return undefined;
    const update = () => setZoom(map.getZoom());
    update();
    map.on('zoomend', update);
    map.on('zoom', update);
    return () => {
      map.off('zoomend', update);
      map.off('zoom', update);
    };
  }, [map]);
  return zoom;
}

/** Uma única chamada a useMap — para componentes que precisam do mapa e do zoom. */
function useMapAndZoom() {
  const map = useMap();
  const [zoom, setZoom] = useState(DEFAULT_MAP_ZOOM);
  useEffect(() => {
    if (!map) return undefined;
    const update = () => setZoom(map.getZoom());
    update();
    map.on('zoomend', update);
    map.on('zoom', update);
    return () => {
      map.off('zoomend', update);
      map.off('zoom', update);
    };
  }, [map]);
  return { map, zoom };
}

/** Mobile: desativa arrastar o mapa Leaflet quando o sheet da loja está expandido (como Google Maps). */
function MapShopSheetDragLock({ locked }) {
  const map = useMap();
  useEffect(() => {
    if (!map?.dragging) return undefined;
    if (locked) {
      map.dragging.disable();
    } else {
      map.dragging.enable();
    }
    return () => {
      try {
        map.dragging.enable();
      } catch (_) {
        /* ignore */
      }
    };
  }, [map, locked]);
  return null;
}

/**
 * Mobile: pan suave para centrar o pin na área útil do mapa (acima do padding inferior do sheet).
 * Desktop: com sidebar à esquerda, centra na faixa visível à direita do padding esquerdo.
 */
function MapUsefulAreaPan({ latLng, bottomPadPx, leftPadPx = 0, panTick }) {
  const map = useMap();
  const padRef = useRef(bottomPadPx);
  padRef.current = bottomPadPx;
  const leftPadRef = useRef(leftPadPx);
  leftPadRef.current = leftPadPx;
  const panLat = latLng?.[0];
  const panLng = latLng?.[1];

  useEffect(() => {
    if (!map || latLng == null || panTick == null || panTick < 1) return undefined;
    const lat = panLat;
    const lng = panLng;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
    let cancelled = false;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (cancelled || !map) return;
        const pad = Math.max(0, Math.round(padRef.current || 0));
        const leftPad = Math.max(0, Math.round(leftPadRef.current || 0));
        const ll = L.latLng(lat, lng);
        let pt;
        try {
          pt = map.latLngToContainerPoint(ll);
        } catch (_) {
          return;
        }
        const size = map.getSize();
        const vx = (size.x + leftPad) / 2;
        const vy = (size.y - pad) / 2;
        const dx = vx - pt.x;
        const dy = vy - pt.y;
        if (Math.abs(dx) < 1.5 && Math.abs(dy) < 1.5) return;
        try {
          const reduce =
            typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
          map.panBy(L.point(dx, dy), reduce ? { animate: false } : { animate: true, duration: 0.38 });
        } catch (_) {
          /* ignore */
        }
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [map, latLng, panLat, panLng, panTick]);

  return null;
}

const DEFAULT_ICON = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

/** Pin de preço: preenchimento suave da mesma cor + contorno forte + número na cor de destaque (unificado com o rótulo). */
function createCategoryIcon(hexColor, bundleCount = 1, compact = false, isOpportunity = false) {
  const n = Math.max(1, Number(bundleCount) || 1);
  const isBundle = n > 1;
  const size = compact ? (isBundle ? 34 : 28) : isBundle ? 40 : 32;
  const half = size / 2;
  const fill = mixWithWhite(hexColor, isBundle ? 0.74 : 0.78);
  const ink = readableAccentOnLightChip(hexColor);
  const dot = compact ? 7 : 9;
  const label = isBundle
    ? `<span style="font-size:${compact ? 12 : 13}px;font-weight:800;color:${ink};line-height:1;">${n}</span>`
    : `<span style="display:block;width:${dot}px;height:${dot}px;border-radius:50%;background:${ink};box-shadow:0 0 0 1.5px rgba(255,255,255,.95);"></span>`;
  const auraClass = isOpportunity ? ' finmemory-price-pin-opportunity' : '';
  return L.divIcon({
    className: 'custom-pin custom-pin-price',
    html: `<div class="finmemory-price-pin-shell${auraClass}" style="position:relative;background:${fill};width:${size}px;height:${size}px;border-radius:50%;border:2.5px solid ${hexColor};box-shadow:0 2px 10px rgba(15,23,42,0.18);display:flex;align-items:center;justify-content:center;">${label}${isOpportunity ? `<span aria-hidden="true" style="position:absolute;top:-5px;left:-5px;border-radius:999px;background:#f59e0b;color:#111827;border:1.5px solid rgba(255,255,255,0.95);padding:1px 5px;font-size:9px;font-weight:800;letter-spacing:0.02em;">TOP</span>` : ''}</div>`,
    iconSize: [size, size],
    iconAnchor: [half, half],
    popupAnchor: [0, -half]
  });
}

/** Círculo de oferta com logo da rede (Dia, Mambo, Pomar da Vila, etc.) + badge de quantidade. */
function createPriceGroupBrandIcon(hexColor, bundleCount, compact, logoUrl, isOpportunity = false) {
  const n = Math.max(1, Number(bundleCount) || 1);
  const isBundle = n > 1;
  const size = compact ? (isBundle ? 38 : 32) : isBundle ? 44 : 36;
  const half = size / 2;
  const fill = mixWithWhite(hexColor, isBundle ? 0.74 : 0.78);
  const ink = readableAccentOnLightChip(hexColor);
  const inner = Math.round(size * 0.62);
  const safeSrc = String(logoUrl || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  const badgeLabel = n > 99 ? '99+' : String(n);
  const bundleBadge = isBundle
    ? `<div aria-hidden="true" style="position:absolute;right:-4px;bottom:-4px;min-width:22px;height:22px;padding:0 5px;border-radius:999px;background:${fill};border:2px solid ${hexColor};box-shadow:0 1px 5px rgba(15,23,42,0.28);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:${ink};line-height:1;z-index:2;">${badgeLabel}</div>`
    : '';
  const html = `<div class="finmemory-store-pin-wrap finmemory-price-pin-logo${isOpportunity ? ' finmemory-price-pin-opportunity' : ''}" style="line-height:0;position:relative;display:inline-block;width:${size}px;height:${size}px;">
<div style="width:${size}px;height:${size}px;border-radius:50%;background:#fff;border:2.5px solid ${hexColor};box-shadow:0 2px 10px rgba(0,0,0,0.2);overflow:hidden;display:flex;align-items:center;justify-content:center;">
<img src="${safeSrc}" alt="" width="${inner}" height="${inner}" style="width:${inner}px;height:${inner}px;object-fit:contain;display:block;pointer-events:none;" referrerpolicy="no-referrer" decoding="async" onerror="this.style.display='none';this.parentNode.style.background='${fill}'" />
</div>
${bundleBadge}
${isOpportunity ? `<div aria-hidden="true" style="position:absolute;top:-5px;left:-5px;border-radius:999px;background:#f59e0b;color:#111827;border:1.5px solid rgba(255,255,255,0.95);padding:1px 5px;font-size:9px;font-weight:800;letter-spacing:0.02em;z-index:3;">TOP</div>` : ''}
</div>`;
  return L.divIcon({
    className: 'custom-pin custom-pin-price custom-pin-price--brand',
    html,
    iconSize: [size, size],
    iconAnchor: [half, half],
    popupAnchor: [0, -half],
  });
}

function createMissionStopIcon(stopNumber = 1) {
  const n = Math.max(1, Number(stopNumber) || 1);
  const size = 34;
  const half = size / 2;
  return L.divIcon({
    className: 'custom-pin finmemory-mission-stop-pin',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:linear-gradient(135deg,#2ECC49 0%,#16a34a 100%);border:2px solid rgba(255,255,255,0.95);box-shadow:0 6px 16px rgba(22,163,74,0.45);display:flex;align-items:center;justify-content:center;color:#052e16;font-weight:900;font-size:13px;line-height:1;">${n}</div>`,
    iconSize: [size, size],
    iconAnchor: [half, half],
    popupAnchor: [0, -half],
  });
}

/** Texto ao lado do pin (estilo Google Maps): curto para não poluir. */
function truncateMapLabel(text, max = 36) {
  const s = String(text || '').trim();
  if (!s) return '';
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1))}…`;
}

function normalizeProductKey(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Rótulo permanente para grupo de preços no mesmo local */
function priceGroupMapLabel(group) {
  const first = group.points[0];
  const name = String(group.nome || first?.nome || '').trim();
  const n = group.points.length;
  if (!name) {
    if (n > 1) return `${n} itens`;
    return truncateMapLabel(first?.produto || 'Preço', 36);
  }
  if (n > 1) return `${truncateMapLabel(name, 30)} · ${n} itens`;
  return truncateMapLabel(name, 36);
}

/** Rótulo para exibição no mapa (estabelecimentos do banco) */
function storeTypeLabel(type) {
  if (!type) return 'Comércio';
  const t = String(type).toLowerCase();
  if (t === 'supermarket') return 'Supermercado';
  if (t === 'pharmacy') return 'Farmácia';
  if (t === 'bakery') return 'Padaria';
  if (t === 'restaurant') return 'Restaurante';
  return 'Comércio';
}

/** Glifo em traço (dentro do círculo branco) — estilo aplicativo de mapas. */
function storePinGlyphPaths(type) {
  const t = String(type || '').toLowerCase();
  if (t === 'supermarket') {
    return '<path d="M-4.5 -1.5h9l-.9 6.2h-7.2l-1-6.2zm1.8 0v-1.8a2.2 2.2 0 114.4 0v1.8"/>';
  }
  if (t === 'pharmacy') {
    return '<path d="M0 -4v8M-4 0h8"/>';
  }
  if (t === 'bakery') {
    return '<path d="M-5.5 2.5a5.5 3.2 0 0111 0"/><path d="M-6 3h12"/>';
  }
  if (t === 'restaurant') {
    return '<path d="M-5.5 -4.5v11M-6.5 -4.5v2.2M-4.5 -4.5v2.2M5 -4.5l1.6 11"/>';
  }
  return '<path d="M-6.5 -1l6.5-3.2 6.5 3.2v8.5h-13z"/><path d="M-3.5 4.5h7"/>';
}

/** Pílula “R$ x,xx” acima do pin (estilo Google Maps / Airbnb). Só números no HTML. */
function storePinHeadlinePillHtml(pinHeadlinePrice) {
  const n = Number(pinHeadlinePrice);
  if (!Number.isFinite(n) || n <= 0) return '';
  const priceFormatted = n.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `<div aria-hidden="true" style="display:flex;justify-content:center;margin-bottom:2px;max-width:min(120px,40vw);"><span style="display:inline-flex;align-items:baseline;gap:1px;background:#2563eb;color:#fff;font-weight:800;font-family:system-ui,-apple-system,sans-serif;font-size:11px;padding:3px 8px 3px 6px;border-radius:999px;box-shadow:0 2px 8px rgba(15,23,42,0.28);border:1px solid rgba(255,255,255,0.35);white-space:nowrap;"><span style="font-size:9px;font-weight:700;opacity:0.95;">R$</span><span style="font-variant-numeric:tabular-nums;font-size:12px;line-height:1;">${priceFormatted}</span></span></div>`;
}

/**
 * Pin de loja: gota + lente branca + ícone em traço.
 * mapPriceBundleCount: preços do mapa colados à loja (evita círculo roxo noutro sítio).
 * (Sem bolinha âmbar de “oferta hoje”: o badge numérico + painel substituem.)
 */
function createStoreIcon(
  type,
  _temOfertaHoje = false,
  storeKey = '',
  mapPriceBundleCount = 0,
  storeNameForColor = '',
  pinHeadlinePrice = null
) {
  const pinColor = getStorePinMainColor(type, storeKey);
  const lensFill = mixWithWhite(pinColor, 0.84);
  const glyph = storePinGlyphPaths(type);
  const promo = '';
  const n = Math.max(0, Number(mapPriceBundleCount) || 0);
  const { main: promoHue } = getCategoryColor(
    'Supermercado - Promoção',
    String(storeNameForColor || storeKey || '')
  );
  const badgeFill = mixWithWhite(promoHue, 0.72);
  const badgeInk = readableAccentOnLightChip(promoHue);
  const badgeLabel = n > 99 ? '99+' : String(n);
  const bundleBadge =
    n > 1
      ? `<div aria-hidden="true" style="position:absolute;right:-4px;bottom:10px;min-width:22px;height:22px;padding:0 5px;border-radius:999px;background:${badgeFill};border:2px solid #fff;box-shadow:0 1px 5px rgba(15,23,42,0.28);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:${badgeInk};line-height:1;z-index:2;">${badgeLabel}</div>`
      : '';
  const headlineBlock = storePinHeadlinePillHtml(pinHeadlinePrice);
  const hasHeadline = Boolean(headlineBlock);
  const html = `<div class="finmemory-store-pin-wrap" style="line-height:0;position:relative;display:inline-flex;flex-direction:column;align-items:center;">
${headlineBlock}
<div style="position:relative;display:inline-block;line-height:0;">
<svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<path fill="${pinColor}" stroke="rgba(255,255,255,0.9)" stroke-width="1"
  style="filter:drop-shadow(0 1.5px 2.5px rgba(0,0,0,.2))"
  d="M14 1.2C6.9 1.2 1 7.1 1 14.1c0 7.4 10.8 18.6 13 20.9 2.2-2.3 13-13.5 13-20.9C27 7.1 21.1 1.2 14 1.2z"/>
<circle cx="14" cy="12.2" r="5.35" fill="${lensFill}"/>
<g transform="translate(14 12.2)" fill="none" stroke="${readableAccentOnLightChip(pinColor)}" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round">
${glyph}
</g>
${promo}
</svg>${bundleBadge}</div></div>`;
  return L.divIcon({
    className: 'custom-pin finmemory-store-pin',
    html,
    iconSize: hasHeadline ? [76, 62] : [28, 36],
    iconAnchor: hasHeadline ? [38, 60] : [14, 34],
    popupAnchor: [0, hasHeadline ? -52 : -30],
  });
}

/**
 * Pin circular com logo da marca (Clearbit etc.). Badge de “N preços” igual ao pin clássico.
 */
function createStoreIconWithLogo(
  logoUrl,
  mapPriceBundleCount,
  storeNameForColor,
  _temOfertaHoje,
  pinHeadlinePrice = null
) {
  const n = Math.max(0, Number(mapPriceBundleCount) || 0);
  const { main: promoHue } = getCategoryColor(
    'Supermercado - Promoção',
    String(storeNameForColor || '')
  );
  const badgeFill = mixWithWhite(promoHue, 0.72);
  const badgeInk = readableAccentOnLightChip(promoHue);
  const badgeLabel = n > 99 ? '99+' : String(n);
  const bundleBadge =
    n > 1
      ? `<div aria-hidden="true" style="position:absolute;right:-5px;bottom:-3px;min-width:22px;height:22px;padding:0 5px;border-radius:999px;background:${badgeFill};border:2px solid #fff;box-shadow:0 1px 5px rgba(15,23,42,0.28);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:${badgeInk};line-height:1;z-index:2;">${badgeLabel}</div>`
      : '';
  /* Sem bolinha âmbar: confundia com “Clique e Retire” / ruído; o badge N + painel bastam. */
  const promoDot = '';
  const safeSrc = String(logoUrl || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  const headlineBlock = storePinHeadlinePillHtml(pinHeadlinePrice);
  const hasHeadline = Boolean(headlineBlock);
  const html = `<div class="finmemory-store-pin-wrap finmemory-store-pin-logo" style="line-height:0;position:relative;display:inline-flex;flex-direction:column;align-items:center;">
${headlineBlock}
<div style="position:relative;display:inline-block;width:40px;height:40px;">
${promoDot}
<div style="width:40px;height:40px;border-radius:50%;background:#fff;border:2.5px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,0.35);overflow:hidden;display:flex;align-items:center;justify-content:center;">
<img src="${safeSrc}" alt="" width="32" height="32" style="width:32px;height:32px;object-fit:contain;display:block;pointer-events:none;" referrerpolicy="no-referrer" decoding="async" onerror="this.style.display='none';this.parentNode.style.background='${badgeFill}';this.parentNode.style.borderColor='${promoHue}'" />
</div>
${bundleBadge}
</div></div>`;
  return L.divIcon({
    className: 'custom-pin finmemory-store-pin finmemory-store-pin--brand',
    html,
    iconSize: hasHeadline ? [76, 64] : [40, 40],
    iconAnchor: hasHeadline ? [38, 62] : [20, 38],
    popupAnchor: [0, hasHeadline ? -54 : -32],
  });
}

/**
 * Carrega estabelecimentos do banco (stores) na área visível do mapa e exibe com ícone por tipo.
 * Não altera os pins de preços compartilhados (price_points).
 */
function StoreMarkers({
  storeFilterName = '',
  searchQuery = '',
  planningMode = false,
  planningItems = [],
  onRequestStoreShop,
  userOrigin = null,
  cartOfferIdSet,
  onStoreOfferCartToggle,
  isMobileMapSheet = false,
  onMobileStorePinOpen,
  onVisibleStoresChange,
  mapPriceCountByStoreId = null,
  /** Desktop sidebar: pin da loja aberta pulsa ao hover nas promoções na lista */
  pulseStoreId = null,
  /** Ref para forçar reload externo (ex.: após Quick Add ou realtime event). */
  reloadRef = null,
}) {
  const { map, zoom } = useMapAndZoom();
  const searchActive = searchQuery.trim().length >= 2;
  const showPinLabels = zoom >= MAP_LABEL_MIN_ZOOM || searchActive;
  const [stores, setStores] = useState([]);
  const lastFittedSearchRef = useRef('');
  const storeFetchDebounceRef = useRef(null);

  const fetchStoresInBounds = useCallback(() => {
    const bounds = map.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const params = new URLSearchParams({
      sw_lat: sw.lat.toFixed(5),
      sw_lng: sw.lng.toFixed(5),
      ne_lat: ne.lat.toFixed(5),
      ne_lng: ne.lng.toFixed(5)
    });
    fetch(`/api/map/stores?${params}`)
      .then((res) => (res.ok ? res.json() : { stores: [] }))
      .then((data) => {
        if (Array.isArray(data.stores)) setStores(data.stores);
      })
      .catch(() => setStores([]));
  }, [map]);

  useEffect(() => {
    if (!map) return undefined;
    const run = () => {
      clearTimeout(storeFetchDebounceRef.current);
      storeFetchDebounceRef.current = setTimeout(() => fetchStoresInBounds(), 400);
    };
    fetchStoresInBounds();
    map.on('moveend', run);
    return () => {
      map.off('moveend', run);
      clearTimeout(storeFetchDebounceRef.current);
    };
  }, [map, fetchStoresInBounds]);

  useEffect(() => {
    if (reloadRef) reloadRef.current = fetchStoresInBounds;
  }, [reloadRef, fetchStoresInBounds]);

  /** Pesquisa aplica-se ao nome da loja (ex.: "Dia"); se nenhuma loja bater, mostra todas (ex.: "arroz" é produto). */
  const effectiveQuery = String(storeFilterName || searchQuery || '')
    .trim()
    .toLowerCase();

  const planningTerms = useMemo(
    () =>
      (Array.isArray(planningItems) ? planningItems : [])
        .map((v) =>
          String(v || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/\p{M}/gu, '')
            .trim()
        )
        .filter((v) => v.length >= 2),
    [planningItems]
  );

  const visibleStores = useMemo(() => {
    let base = stores;
    if (planningMode && planningTerms.length > 0) {
      const matchesPlanning = (store) => {
        const haystack = [
          store.name,
          ...(Array.isArray(store.offer_products) ? store.offer_products : []),
          ...(Array.isArray(store.offer_preview) ? store.offer_preview.map((o) => o?.product_name) : []),
        ]
          .map((v) =>
            String(v || '')
              .toLowerCase()
              .normalize('NFD')
              .replace(/\p{M}/gu, '')
          )
          .join(' | ');
        return planningTerms.some((term) => haystack.includes(term));
      };
      base = stores.filter(matchesPlanning);
    }
    if (effectiveQuery.length < 2) return base;
    const matched = base.filter((s) => String(s.name || '').toLowerCase().includes(effectiveQuery));
    return matched.length > 0 ? matched : base;
  }, [stores, effectiveQuery, planningMode, planningTerms]);

  useEffect(() => {
    onVisibleStoresChange?.(visibleStores);
  }, [visibleStores, onVisibleStoresChange]);

  /** Centrar no(s) pin(s) quando a busca coincide com nome de loja (estilo “encontrar no mapa”). */
  useEffect(() => {
    if (!map || effectiveQuery.length < 2) {
      if (effectiveQuery.length < 2) lastFittedSearchRef.current = '';
      return;
    }
    const matched = stores.filter((s) => String(s.name || '').toLowerCase().includes(effectiveQuery));
    if (matched.length === 0) return;
    if (lastFittedSearchRef.current === effectiveQuery) return;
    lastFittedSearchRef.current = effectiveQuery;
    try {
      if (matched.length === 1) {
        const s = matched[0];
        map.flyTo([Number(s.lat), Number(s.lng)], Math.max(map.getZoom(), 15), { duration: 0.45 });
        return;
      }
      const bounds = L.latLngBounds(matched.map((s) => [Number(s.lat), Number(s.lng)]));
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 17, animate: true, duration: 0.45 });
    } catch (e) {
      console.warn('fitBounds lojas (busca):', e);
    }
  }, [map, stores, effectiveQuery]);

  return (
    <>
      {visibleStores.map((store) => (
        <StoreMarkerItem
          key={store.id}
          store={store}
          showPinLabels={showPinLabels}
          onRequestStoreShop={onRequestStoreShop}
          userOrigin={userOrigin}
          cartOfferIdSet={cartOfferIdSet}
          onStoreOfferCartToggle={onStoreOfferCartToggle}
          isMobileMapSheet={isMobileMapSheet}
          onMobileStorePinOpen={onMobileStorePinOpen}
          mapPriceBundleCount={Number(mapPriceCountByStoreId?.[String(store.id)]) || 0}
          pulseHighlight={
            pulseStoreId != null && String(pulseStoreId) === String(store.id)
          }
        />
      ))}
    </>
  );
}

/**
 * Ícone Leaflet estável: recriar divIcon a cada render faz setIcon() e o popup fecha sozinho.
 */
function StoreMarkerItem({
  store,
  showPinLabels,
  onRequestStoreShop,
  userOrigin = null,
  cartOfferIdSet,
  onStoreOfferCartToggle,
  isMobileMapSheet = false,
  onMobileStorePinOpen,
  mapPriceBundleCount = 0,
  pulseHighlight = false,
}) {
  const logoUrl = useMemo(() => {
    const pinned = String(store.pin_logo_url || '').trim();
    if (pinned && isClientUsablePinLogoRef(pinned)) return pinned;
    return getStoreLogoPinSrc(store.name);
  }, [store.name, store.pin_logo_url]);

  const pinColor = useMemo(
    () => getStorePinMainColor(store.type, store.id),
    [store.type, store.id]
  );
  const pinHeadlinePrice = useMemo(() => {
    const fromN = parsePriceToNumber(store.pin_headline_price);
    if (fromN != null) return fromN;
    const p0 = Array.isArray(store.offer_preview) ? store.offer_preview[0] : null;
    return parsePriceToNumber(p0?.price);
  }, [store.pin_headline_price, store.offer_preview]);
  const icon = useMemo(
    () =>
      logoUrl
        ? createStoreIconWithLogo(
            logoUrl,
            mapPriceBundleCount,
            store.name,
            !!store.tem_oferta_hoje,
            pinHeadlinePrice
          )
        : createStoreIcon(
            store.type,
            !!store.tem_oferta_hoje,
            store.id,
            mapPriceBundleCount,
            store.name,
            pinHeadlinePrice
          ),
    [
      logoUrl,
      store.type,
      store.tem_oferta_hoje,
      store.id,
      mapPriceBundleCount,
      store.name,
      pinHeadlinePrice,
    ]
  );
  const labelOpenAirStyle = useMemo(() => getMapPinOpenAirLabelStyle(pinColor), [pinColor]);

  const markerEventHandlers = useMemo(
    () => ({
      click: (e) => {
        L.DomEvent.stop(e);
        if (isMobileMapSheet && typeof onMobileStorePinOpen === 'function') {
          onMobileStorePinOpen(store);
        } else if (!isMobileMapSheet && typeof onRequestStoreShop === 'function') {
          onRequestStoreShop(store);
        }
      },
    }),
    [isMobileMapSheet, onMobileStorePinOpen, onRequestStoreShop, store]
  );

  const markerRef = useRef(null);
  useEffect(() => {
    const inst = markerRef.current;
    const el =
      inst && typeof inst.getElement === 'function' ? inst.getElement() : null;
    if (!el) return;
    if (pulseHighlight) el.classList.add('finmemory-store-pin--hover-pulse');
    else el.classList.remove('finmemory-store-pin--hover-pulse');
  }, [pulseHighlight, icon]);

  return (
    /** Acima dos círculos de preço/promo (2500); senão milhares de ofertas DIA tapam os pins de loja. */
    <Marker
      ref={markerRef}
      position={[Number(store.lat), Number(store.lng)]}
      icon={icon}
      zIndexOffset={3500}
      eventHandlers={markerEventHandlers ?? {}}
    >
      {showPinLabels && (
        <Tooltip
          permanent
          direction="right"
          offset={[12, 0]}
          opacity={1}
          interactive={false}
          className="finmemory-map-label finmemory-map-label--store"
        >
          <span
            className="finmemory-map-label-text finmemory-map-label-text--store"
            style={{
              ...labelOpenAirStyle,
              display: 'inline-block',
              maxWidth: 'min(240px, 56vw)',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              lineHeight: 1.25,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              verticalAlign: 'middle',
            }}
          >
            {truncateMapLabel(store.name, 40)}
          </span>
        </Tooltip>
      )}
    </Marker>
  );
}

/**
 * Localização no mapa: só pede ao utilizador depois de um toque no botão.
 * Em muitos telemóveis o browser bloqueia GPS se for pedido ao abrir a página.
 * onLocationFound(lat, lng) é chamado quando a localização é obtida (para geo-fencing).
 */
function LocationMarker({ onLocationFound, onUserPositionChange, headerOffsetPx = 56 }) {
  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const [locating, setLocating] = useState(false);
  const { map, zoom } = useMapAndZoom();
  const showYouLabel = zoom >= MAP_LABEL_MIN_ZOOM;
  const isDesktopChrome = useMatchMedia('(min-width: 768px)');
  const onLocationFoundRef = useRef(onLocationFound);
  onLocationFoundRef.current = onLocationFound;
  const onUserPositionChangeRef = useRef(onUserPositionChange);
  onUserPositionChangeRef.current = onUserPositionChange;

  const requestLocation = useCallback(() => {
    if (!map) return;
    setError(null);
    setLocating(true);
    // setView: false — um único flyTo no handler evita animação dupla e “pulos” do mapa
    map.locate({ setView: false, watch: false, maxZoom: 16, timeout: 15000, enableHighAccuracy: true });
  }, [map]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onHeaderDirections = () => requestLocation();
    window.addEventListener('finmemory-map-request-location', onHeaderDirections);
    return () => window.removeEventListener('finmemory-map-request-location', onHeaderDirections);
  }, [requestLocation]);

  useEffect(() => {
    if (!map) return;
    const onFound = (e) => {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      setPosition([lat, lng]);
      setError(null);
      setLocating(false);
      map.flyTo(e.latlng, Math.max(map.getZoom(), 15));
      onLocationFoundRef.current?.(lat, lng);
      onUserPositionChangeRef.current?.(lat, lng);
    };
    const onError = (e) => {
      setLocating(false);
      const msg = e?.message || '';
      if (msg.includes('Permission denied') || msg.includes('denied')) {
        setError('Permissão negada. Ative a localização nas definições do navegador/site.');
      } else if (msg.includes('timeout') || msg.includes('unavailable')) {
        setError('Tempo esgotado. Verifique se o GPS está ligado e tente de novo.');
      } else {
        setError('Não foi possível obter a localização. Ative o GPS e tente tocar em "Minha localização".');
      }
    };
    map.on('locationfound', onFound);
    map.on('locationerror', onError);
    return () => {
      map.off('locationfound', onFound);
      map.off('locationerror', onError);
    };
  }, [map]);

  return (
    <>
      {position && (
        <Marker position={position} icon={DEFAULT_ICON} zIndexOffset={5000}>
          {showYouLabel && (
            <Tooltip
              permanent
              direction="right"
              offset={[14, -28]}
              opacity={1}
              interactive={false}
              className="finmemory-map-label finmemory-map-label--you"
            >
              Você está aqui
            </Tooltip>
          )}
          <Popup>Você está aqui! 📍</Popup>
        </Marker>
      )}
      {isDesktopChrome ? (
        <div style={{ position: 'absolute', top: headerOffsetPx + 8, right: 10, zIndex: 1000 }}>
          <button
            type="button"
            onClick={requestLocation}
            disabled={locating}
            className="bg-white border border-gray-300 shadow-md rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 flex items-center gap-1.5"
            title="Centrar mapa na minha localização"
          >
            {locating ? <>⏳ A obter...</> : <>📍 Minha localização</>}
          </button>
          {error && (
            <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800 shadow max-w-[220px]">
              {error}
            </div>
          )}
        </div>
      ) : (
        <div
          className="absolute z-[1000] flex flex-col items-end gap-2 pointer-events-none"
          style={{
            right: 12,
            bottom: 'calc(4.25rem + env(safe-area-inset-bottom, 0px))',
          }}
        >
          <button
            type="button"
            onClick={requestLocation}
            disabled={locating}
            title="Minha localização"
            aria-label="Centrar mapa na minha localização"
            className="pointer-events-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-[#1a73e8] shadow-[0_2px_8px_rgba(60,64,67,0.35)] border border-gray-100 hover:bg-gray-50 disabled:opacity-60 active:scale-95 transition-transform"
          >
            {locating ? (
              <span className="text-lg" aria-hidden>
                ⏳
              </span>
            ) : (
              <Navigation className="h-6 w-6" strokeWidth={2.25} />
            )}
          </button>
          {error ? (
            <div className="pointer-events-auto max-w-[min(280px,85vw)] bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-[11px] text-amber-900 shadow-md">
              {error}
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}

/** Busca todos os pontos recentes do mapa (sem ?q). O filtro por busca é feito no cliente — assim as ofertas da loja e os pins não “dessincronizam”. */
/**
 * Preço no mapa: encartes Dia não têm preço no JSON do site — nunca mostrar centavo fictício.
 * Linhas promo-* ou categoria com "promo": tratar ≤ R$ 0,01 como sem valor numérico.
 */
function formatPrecoExibicao(preco, categoria, id) {
  const n = parsePriceToNumber(preco);
  if (n == null) return null;
  const promoLike =
    String(id || '').startsWith('promo-') ||
    String(categoria || '').toLowerCase().includes('promo');
  if (promoLike && n <= 0.01) return null;
  return `R$ ${formatBRLPriceNum(n)}`;
}

/** Primeiro campo que parseia para valor > 0 (promo, clube, price, etc.). */
function firstPositivePriceNumber(...values) {
  for (const v of values) {
    const n = parsePriceToNumber(v);
    if (n != null && n > 0) return n;
  }
  return null;
}

/** Soma no carrinho / orçamento: ignora placeholder de centavo no agente (`promo-*`). */
function numericPriceForSum(preco, categoria, id) {
  const n = parsePriceToNumber(preco);
  if (n == null) return null;
  const idStr = String(id || '');
  // Linhas do encarte (tabela promotions): não zerar por categoria "Promoção" nem conflito com regra do agente
  if (idStr.startsWith('encarte-')) return n;
  const promoLike =
    idStr.startsWith('promo-') ||
    String(categoria || '').toLowerCase().includes('promo');
  if (promoLike && n <= 0.01) return null;
  return n;
}

/** Pedidos GET idênticos em voo (ex.: mount + moveend) — uma só ida ao servidor. */
const mapPointsInflight = new Map();

/**
 * Busca pontos: modo produto (q) = global; modo mapa = bbox da área visível.
 * @param {{ type: 'none' | 'product' | 'region', q?: string }} searchIntent
 */
async function fetchMapPoints(map, searchIntent) {
  try {
    const params = new URLSearchParams();
    if (searchIntent.type === 'product' && searchIntent.q) {
      params.set('q', searchIntent.q);
    } else if (map) {
      const b = map.getBounds();
      const sw = b.getSouthWest();
      const ne = b.getNorthEast();
      params.set('sw_lat', sw.lat.toFixed(5));
      params.set('sw_lng', sw.lng.toFixed(5));
      params.set('ne_lat', ne.lat.toFixed(5));
      params.set('ne_lng', ne.lng.toFixed(5));
    }
    const qs = params.toString();
    const inflightKey = qs || '__global__';
    const existing = mapPointsInflight.get(inflightKey);
    if (existing) return existing;

    const promise = (async () => {
      try {
        const res = await fetch(qs ? `/api/map/points?${qs}` : '/api/map/points');
        if (!res.ok) return [];
        const json = await res.json();
        const points = json.points || [];
        return points.map((p) => ({
          id: p.id,
          nome: p.store_name,
          produto: displayPromoProductName(p.product_name, p.store_name),
          preco: p.price,
          precoLabel: formatPrecoExibicao(p.price, p.category, p.id),
          promo_image_url: p.promo_image_url || null,
          lat: Number(p.lat),
          lng: Number(p.lng),
          categoria: p.category || '',
          time_ago: p.time_ago,
          user_label: p.user_label,
        }));
      } catch (e) {
        console.warn('Erro ao buscar pontos do mapa:', e);
        return [];
      } finally {
        mapPointsInflight.delete(inflightKey);
      }
    })();

    mapPointsInflight.set(inflightKey, promise);
    return promise;
  } catch (e) {
    console.warn('Erro ao buscar pontos do mapa:', e);
    return [];
  }
}

const MAP_VIEWPORT_MERGE_MAX = 1600;

/**
 * Mantém pins já carregados na área visível (com margem) ao atualizar por bbox.
 * Evita “sumir tudo” quando o viewport oscila, há limite na API ou corrida durante fitBounds/flyTo.
 */
function mergeViewportPricePoints(map, prev, incoming) {
  if (!map || !Array.isArray(incoming)) return incoming || [];
  let bounds;
  try {
    bounds = map.getBounds().pad(0.28);
  } catch {
    return incoming;
  }
  const byId = new Map();
  for (const p of incoming) {
    const lat = Number(p.lat);
    const lng = Number(p.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    byId.set(p.id, p);
  }
  if (Array.isArray(prev)) {
    for (const p of prev) {
      if (byId.has(p.id)) continue;
      const lat = Number(p.lat);
      const lng = Number(p.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      try {
        if (!bounds.contains(L.latLng(lat, lng))) continue;
      } catch {
        continue;
      }
      byId.set(p.id, p);
    }
  }
  const out = Array.from(byId.values());
  if (out.length <= MAP_VIEWPORT_MERGE_MAX) return out;
  out.sort((a, b) => String(b.id || '').localeCompare(String(a.id || '')));
  return out.slice(0, MAP_VIEWPORT_MERGE_MAX);
}

/**
 * Após resolver bairro/cidade (geocode), ajusta o mapa à região; no moveend libera modo “viewport”.
 */
function MapRegionFly({ searchQuery, searchIntent, onRegionFitted }) {
  const map = useMap();
  const regionKeyRef = useRef('');

  useEffect(() => {
    regionKeyRef.current = '';
  }, [searchQuery]);

  useEffect(() => {
    if (searchIntent.type !== 'region') {
      regionKeyRef.current = '';
    }
  }, [searchIntent.type]);

  useEffect(() => {
    if (!map || searchIntent.type !== 'region' || !searchIntent.bbox) return;

    const b = searchIntent.bbox;
    const key = `${b.sw_lat},${b.sw_lng},${b.ne_lat},${b.ne_lng}`;
    if (regionKeyRef.current === key) return;
    regionKeyRef.current = key;

    const bounds = L.latLngBounds([b.sw_lat, b.sw_lng], [b.ne_lat, b.ne_lng]);
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      onRegionFitted();
    };

    const fallback = setTimeout(finish, 1200);
    map.once('moveend', () => {
      clearTimeout(fallback);
      finish();
    });
    map.fitBounds(bounds, { padding: [44, 44], maxZoom: 14, animate: true });
  }, [map, searchIntent, onRegionFitted]);

  return null;
}

function PlanningActionController({
  request,
  summary,
  storesVisibleOnMap,
  onOpenStore,
  setMapUsefulPanTick,
  onApplyMoneyPlan,
}) {
  const map = useMap();
  const lastHandledIdRef = useRef(null);

  useEffect(() => {
    const id = Number(request?.id || 0);
    if (!id || id === lastHandledIdRef.current) return;
    lastHandledIdRef.current = id;

    const mode = String(request?.mode || '');
    if (mode === 'money') {
      const picks = Array.isArray(summary?.cheapest?.picks) ? summary.cheapest.picks : [];
      const coords = picks
        .map((p) => [Number(p?.lat), Number(p?.lng)])
        .filter((c) => Number.isFinite(c[0]) && Number.isFinite(c[1]));
      if (coords.length === 0) return;
      try {
        onApplyMoneyPlan?.(picks);
        if (coords.length === 1) {
          map.flyTo(coords[0], Math.max(map.getZoom(), 15), { duration: 0.45 });
        } else {
          const bounds = L.latLngBounds(coords);
          map.fitBounds(bounds, { padding: [44, 44], maxZoom: 16, animate: true, duration: 0.45 });
        }
        setMapUsefulPanTick?.((n) => n + 1);
      } catch (e) {
        console.warn('planning money fitBounds', e);
      }
      return;
    }

    if (mode === 'time' || mode === 'quality') {
      const targetName = String(mode === 'quality' ? summary?.quality?.storeName : summary?.oneStore?.storeName)
        .trim()
        .toLowerCase();
      if (!targetName) return;
      const store = (storesVisibleOnMap || []).find(
        (s) => String(s?.name || '').trim().toLowerCase() === targetName
      );
      if (!store) return;
      try {
        const lat = Number(store.lat);
        const lng = Number(store.lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          map.flyTo([lat, lng], Math.max(map.getZoom(), 15), { duration: 0.45 });
        }
        onOpenStore?.(store);
      } catch (e) {
        console.warn('planning time openStore', e);
      }
    }
  }, [request, summary, storesVisibleOnMap, onOpenStore, map, setMapUsefulPanTick, onApplyMoneyPlan]);

  return null;
}

/** Carrega pontos: busca por produto (global) ou por área visível (região / pan). */
function PricePointsLoader({ searchIntent, setLocais, setCarregando, reloadRef }) {
  const map = useMap();
  const debounceRef = useRef(null);
  /** Evita que uma resposta lenta (viewport antigo) substitua pins de um movimento mais recente. */
  const loadGenerationRef = useRef(0);
  /** Último conjunto aplicado — merge no viewport sem depender de `locais` no closure do load. */
  const locaisSnapshotRef = useRef([]);
  /** Após busca global por produto, o primeiro fetch por bbox deve substituir (não misturar com o global). */
  const afterProductViewportRef = useRef(false);
  const productMode = searchIntent.type === 'product';

  const load = useCallback(async () => {
    if (!map) return;
    if (searchIntent.type === 'region') return;
    const gen = ++loadGenerationRef.current;
    setCarregando(true);
    try {
      const points = await fetchMapPoints(map, searchIntent);
      if (gen !== loadGenerationRef.current) return;
      const raw = points.filter((p) => !Number.isNaN(p.lat) && !Number.isNaN(p.lng));
      const wasProduct = searchIntent.type === 'product';

      if (wasProduct) {
        afterProductViewportRef.current = true;
        locaisSnapshotRef.current = raw;
        setLocais(raw);
        return;
      }

      /* Resposta vazia com mapa já povoado: não substituir (evita apagar pins por corrida/animacao ou falha transitória). */
      if (raw.length === 0 && locaisSnapshotRef.current.length > 12) {
        return;
      }

      let next;
      if (afterProductViewportRef.current) {
        afterProductViewportRef.current = false;
        next = raw;
      } else {
        next = mergeViewportPricePoints(map, locaisSnapshotRef.current, raw);
      }
      locaisSnapshotRef.current = next;
      setLocais(next);
    } catch (error) {
      console.error('Erro ao buscar locais:', error);
    } finally {
      if (gen === loadGenerationRef.current) {
        setCarregando(false);
      }
    }
  }, [map, searchIntent, setLocais, setCarregando]);

  useEffect(() => {
    reloadRef.current = () => {
      load();
    };
  }, [load, reloadRef]);

  useEffect(() => {
    if (!map) return undefined;
    load();
    return undefined;
  }, [map, searchIntent, load]);

  useEffect(() => {
    if (!map || productMode) return undefined;
    const onMoveEnd = () => {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => load(), 400);
    };
    map.on('moveend', onMoveEnd);
    return () => {
      map.off('moveend', onMoveEnd);
      clearTimeout(debounceRef.current);
    };
  }, [map, productMode, load]);

  return null;
}

/**
 * Agrupa pontos pelo mesmo local (lat/lng arredondados) para evitar marcadores empilhados.
 * Posição do pin = média dos pontos do grupo — se usássemos só o 1.º ponto, cada refresh da API
 * (ordem diferente) fazia o pin “correr” dentro do mesmo bucket.
 */
function groupPointsByLocation(points) {
  const groups = new Map();
  const round = (n) => Number(n).toFixed(5);
  points.forEach((p) => {
    const key = `${round(p.lat)}_${round(p.lng)}`;
    if (!groups.has(key)) {
      groups.set(key, { points: [], nome: '' });
    }
    const g = groups.get(key);
    g.points.push(p);
    if (!g.nome && p.nome) g.nome = p.nome;
  });
  return Array.from(groups.entries()).map(([groupKey, g]) => {
    let sumLat = 0;
    let sumLng = 0;
    const n = g.points.length;
    for (let i = 0; i < n; i++) {
      sumLat += Number(g.points[i].lat);
      sumLng += Number(g.points[i].lng);
    }
    const lat = sumLat / n;
    const lng = sumLng / n;
    return {
      groupKey,
      lat: Math.round(lat * 1e6) / 1e6,
      lng: Math.round(lng * 1e6) / 1e6,
      points: g.points,
      nome: g.nome
    };
  });
}

/** Distância em metros (WGS84). */
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lng2 - lng1);
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normNameForMatch(x) {
  return String(x || '')
    .toLowerCase()
    .replace(/[^a-z0-9àáâãéêíóôõúüç]/gi, '')
    .replace(/\s+/g, '');
}

/** Mesma rede em texto normalizado (ex.: loja "Mambo Brooklin" vs pin "Mambo · ofertas"). */
const MAP_MERGE_CHAIN_SLUGS = [
  'mambo',
  'dia',
  'assai',
  'carrefour',
  'paodeacucar',
  'paoacucar',
  'hirota',
  'lopes',
  'sonda',
  'saojorge',
  'pomar',
  'agape',
  'armazemdocampo',
  'mercadinhosaojorge',
  'supermercadopadr',
  'padraosuper',
];

function shareMapChainSlug(storeName, group) {
  const groupNome = String(group.nome || group.points?.[0]?.nome || '').trim();
  if (!groupNome) return false;
  const a = normNameForMatch(storeName);
  const b = normNameForMatch(groupNome);
  if (!a || !b) return false;
  return MAP_MERGE_CHAIN_SLUGS.some((slug) => a.includes(slug) && b.includes(slug));
}

/** Evita colar cluster de outra loja só por estarem perto. */
function storeNameLikelyMatchesPriceGroup(storeName, group) {
  const groupNome = String(group.nome || group.points?.[0]?.nome || '').trim();
  if (!groupNome) return true;
  const a = normNameForMatch(storeName);
  const b = normNameForMatch(groupNome);
  if (!a || !b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const p = Math.min(6, a.length, b.length);
  if (p >= 4 && a.slice(0, p) === b.slice(0, p)) return true;
  return shareMapChainSlug(storeName, group);
}

/**
 * Grupos de preço com média de coords deslocada vs. loja curada: associa ao pin certo por
 * proximidade + nome, remove o círculo roxo solto e devolve contagem para o badge no pin da loja.
 */
function mergePriceGroupsOntoNearbyStores(priceGroups, stores, maxMeters = 380) {
  const empty = { priceGroupsForMarkers: priceGroups || [], mapPriceCountByStoreId: {} };
  if (!Array.isArray(priceGroups) || priceGroups.length === 0) return empty;
  const storeList = (stores || []).filter(
    (s) => Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lng))
  );
  if (storeList.length === 0) return empty;

  const consumedKeys = new Set();
  const mapPriceCountByStoreId = {};

  for (const g of priceGroups) {
    const candidates = storeList
      .map((s) => ({
        s,
        d: haversineMeters(Number(s.lat), Number(s.lng), g.lat, g.lng),
      }))
      .filter((x) => x.d <= maxMeters)
      .sort((a, b) => a.d - b.d);

    if (candidates.length === 0) continue;

    const nameHits = candidates.filter((x) => storeNameLikelyMatchesPriceGroup(x.s.name, g));
    let pick = null;
    if (nameHits.length >= 1) {
      pick = nameHits[0].s;
    } else if (candidates.length === 1) {
      pick = candidates[0].s;
    }

    if (pick) {
      consumedKeys.add(g.groupKey);
      const sid = String(pick.id);
      mapPriceCountByStoreId[sid] = (mapPriceCountByStoreId[sid] || 0) + g.points.length;
    }
  }

  return {
    priceGroupsForMarkers: priceGroups.filter((g) => !consumedKeys.has(g.groupKey)),
    mapPriceCountByStoreId,
  };
}

function isPromoPoint(p) {
  const c = String(p.categoria || '').toLowerCase();
  return c.includes('promo') || String(p.id || '').startsWith('promo-');
}

function categoryFallbackGlyph(category) {
  const c = String(category || '').toLowerCase();
  if (c.includes('farm')) return '💊';
  if (c.includes('padar')) return '🥖';
  if (c.includes('restaur')) return '🍽️';
  if (c.includes('açougue') || c.includes('acougue')) return '🥩';
  if (c.includes('bebida')) return '🥤';
  if (c.includes('higiene') || c.includes('beleza')) return '🧴';
  return '🛒';
}

/** URL que não deve ser carregada como <img> (PDF / encarte). Evitar "folder" solto — aparece em paths de CDN e bloqueava fotos. */
function isEncarteOrNonImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const u = url.trim().toLowerCase();
  if (u.includes('.pdf') || /[?&]format=pdf\b/.test(u)) return true;
  return /\/encarte\/|encarte\.|tablo[ií]de|folheto|ofertas\/pdf|\/folheto\//i.test(u);
}

/** Miniaturas no mapa: só https:// (nunca data: — memória e payloads). */
function isDisplayableImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return false;
  if (/^data:/i.test(trimmed)) return false;
  if (!/^https:\/\//i.test(trimmed)) return false;
  if (isEncarteOrNonImageUrl(url)) return false;
  const u = trimmed.toLowerCase();
  if (/\.(webp|jpg|jpeg|png|gif|avif|svg)(\?|#|$|&)/i.test(u)) return true;
  if (
    /imgur|cloudinary|imgix|supabase.*\/storage|googleusercontent|twimg|gpa\.digital|paodeacucar|dia\.com\.br|cdn|akamai|cloudfront|openfoodfacts\.org/i.test(
      u
    )
  ) {
    return true;
  }
  return !/\.(pdf|zip)(\?|$)/i.test(u);
}

function uniqueDisplayableImageUrls(points) {
  const seen = new Set();
  const out = [];
  for (const p of points) {
    const u = p.promo_image_url;
    if (!u || !isDisplayableImageUrl(u)) continue;
    const key = String(u).trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

/** Fachada / imagem da loja (`stores.photo_url`) — contexto antes das fotos de produto. */
function StoreBelongingBanner({ store }) {
  const u = store?.photo_url;
  if (!u || !isDisplayableImageUrl(u)) return null;
  const raw = String(u).trim();
  const src = getMapProductImageSrcForImg(raw) || raw;
  return (
    <div className="relative h-[88px] w-full shrink-0 overflow-hidden bg-slate-200">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="finmemory-offer-photo absolute inset-0 h-full w-full object-cover"
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/78 via-black/25 to-transparent"
        aria-hidden
      />
      <p className="absolute bottom-1.5 left-2 right-3 text-[10px] font-medium leading-snug text-white drop-shadow-md line-clamp-2">
        <span className="font-bold">{store.name}</span>
        {' · '}
        Nossa loja te espera — ofertas na vitrine.
      </p>
    </div>
  );
}

/** Dados enriquecidos de `/api/map/stores` → hero + cards no popup da loja. */
function useStoreOfferPreview(store) {
  const preview = Array.isArray(store?.offer_preview) ? store.offer_preview : [];
  const heroPoints = useMemo(
    () => preview.map((o) => ({ promo_image_url: o.promo_image_url })),
    [preview]
  );
  const heroSources = useMemo(() => uniqueDisplayableImageUrls(heroPoints), [heroPoints]);
  const accentHex = useMemo(() => {
    if (preview.length === 0) return '#2ECC49';
    return getCategoryColor(preview[0]?.category || 'Supermercado - Promoção', store.name).main;
  }, [preview, store.name]);
  const heroCategory = preview.length ? preview[0]?.category || '' : '';
  return { preview, heroSources, accentHex, heroCategory };
}

/** Corpo do card de loja (popup desktop ou bottom sheet mobile) — dados de `offer_preview` no pin. */
function StoreMarkerOfferPanelBody({
  store,
  userOrigin = null,
  cartOfferIdSet,
  onStoreOfferCartToggle,
  onRequestStoreShop,
  hideDirections = false,
  peekOnly = false,
  rootClassName,
  trailingHeaderAction = null,
  /** Cabeçalho (tipo, nome, endereço) renderizado fora do scroll no bottom sheet mobile */
  suppressBuiltInHeader = false,
  /** Grelha/lista de ofertas usa o scroll do sheet (evita conflito com pull-to-recolher) */
  disableInnerProductScroll = false,
  /** Permite que toques verticais subam para o sheet (pull quando scrollTop=0) */
  allowRootTouchPropagation = false,
  /** Filtro local por nome de produto (ex.: busca no sticky do bottom sheet) */
  offerNameFilter = '',
}) {
  const pinColor = useMemo(
    () => getStorePinMainColor(store.type, store.id),
    [store.type, store.id]
  );
  const { preview, heroSources, accentHex, heroCategory } = useStoreOfferPreview(store);
  const previewFiltered = useMemo(() => {
    const q = String(offerNameFilter || '').trim().toLowerCase();
    if (!q) return preview;
    return preview.filter((o) =>
      displayPromoProductName(o.product_name, store.name).toLowerCase().includes(q)
    );
  }, [preview, offerNameFilter, store.name]);
  const hasCardOffers = store.tem_oferta_hoje && preview.length > 0;
  const offerTotalForUi = Math.max(Number(store.offer_count) || 0, preview.length);
  const offerPreviewTruncated = offerTotalForUi > preview.length;
  const defaultRoot = hasCardOffers
    ? 'finmemory-popup-store-offers min-w-0 w-[min(100vw-2rem,300px)] max-w-[300px] overflow-hidden rounded-lg'
    : 'finmemory-popup-store-offers min-w-[180px] overflow-hidden rounded-lg';

  const rootTouchProps = allowRootTouchPropagation
    ? {}
    : { onTouchStart: (e) => e.stopPropagation() };

  return (
    <div
      className={rootClassName ?? defaultRoot}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      {...rootTouchProps}
    >
      {!suppressBuiltInHeader ? (
        <div className="p-2 pb-1 relative">
          {trailingHeaderAction ? (
            <div className="absolute right-0 top-0 z-[1]">{trailingHeaderAction}</div>
          ) : null}
          <span
            className="inline-block text-[11px] font-bold mb-1 border-b-2 pb-0.5"
            style={{
              color: readableAccentOnLightChip(pinColor),
              borderColor: `${pinColor}99`,
            }}
          >
            {storeTypeLabel(store.type)}
          </span>
          <h3
            className={`font-bold text-gray-900 text-sm mt-1 ${trailingHeaderAction ? 'pr-10' : ''}`}
          >
            {store.name}
          </h3>
          {store.address && <p className="text-xs text-gray-600 mt-0.5">{store.address}</p>}
          {store.neighborhood && <p className="text-xs text-gray-500">{store.neighborhood}</p>}
        </div>
      ) : null}

      {peekOnly && hasCardOffers ? (
        <div className="px-2 pb-1 pt-0">
          <p className="text-xs font-semibold text-amber-800">
            Ofertas ativas: {store.offer_count || 0}
          </p>
          <div className="mt-1 flex flex-col gap-0.5">
            <span
              className="inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white shadow-sm"
              style={{ backgroundColor: accentHex }}
            >
              {offerPreviewTruncated
                ? `Mostrando ${preview.length} de ${offerTotalForUi}`
                : `${preview.length} ${preview.length === 1 ? 'item' : 'itens'}`}
            </span>
            {offerPreviewTruncated ? (
              <span className="text-[10px] text-amber-900/90">Lista completa em «Ver promoções».</span>
            ) : null}
          </div>
        </div>
      ) : null}

      {!peekOnly && hasCardOffers ? (
        <div className="overflow-hidden">
          <StoreBelongingBanner store={store} />
          <HeroOfferCarousel
            sources={heroSources}
            storeTitle={store.name}
            count={store.offer_count || preview.length}
            category={heroCategory}
            dense
          />
        </div>
      ) : null}

      {!peekOnly &&
      !hideDirections &&
      Number.isFinite(Number(store.lat)) &&
      Number.isFinite(Number(store.lng)) ? (
        <div className="px-2 pt-2">
          <MapDirectionsRow lat={store.lat} lng={store.lng} userOrigin={userOrigin} dense />
        </div>
      ) : null}

      {!peekOnly && hasCardOffers ? (
        <div className="px-2 pb-1 pt-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <p className="text-[11px] font-semibold text-amber-800 m-0">
              Ofertas ativas: {store.offer_count || 0}
            </p>
            <span
              className="inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-bold text-white shadow-sm"
              style={{ backgroundColor: accentHex }}
            >
              {offerPreviewTruncated
                ? `Mostrando ${preview.length} de ${offerTotalForUi}`
                : `${preview.length} ${preview.length === 1 ? 'item' : 'itens'}`}
            </span>
            {offerPreviewTruncated ? (
              <span className="text-[9px] text-amber-900/85 leading-tight">Lista completa em «Ver promoções».</span>
            ) : null}
          </div>
          <div
            className={
              disableInnerProductScroll
                ? 'mt-1.5 grid grid-cols-2 gap-1.5 pr-0.5 -mr-0.5'
                : 'mt-1.5 grid grid-cols-2 gap-1.5 max-h-[min(300px,46vh)] overflow-y-auto pr-0.5 -mr-0.5'
            }
            style={{ touchAction: 'pan-y', scrollbarGutter: 'stable' }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={disableInnerProductScroll ? undefined : (e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
          >
            {previewFiltered.length === 0 && preview.length > 0 ? (
              <p className="col-span-2 py-3 text-center text-[12px] text-gray-500">
                Nenhuma oferta corresponde à busca.
              </p>
            ) : null}
            {previewFiltered.map((o, i) => {
              const label = formatPrecoExibicao(o.price, o.category, o.id);
              const priceSlot =
                label != null ? (
                  label
                ) : o.promo_image_url && isEncarteOrNonImageUrl(o.promo_image_url) ? (
                  <a
                    href={o.promo_image_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-emerald-700 font-semibold text-[11px]"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    Ver encarte
                  </a>
                ) : (
                  <span className="text-gray-500 text-[11px]">Promoção</span>
                );
              const point = {
                id: o.id,
                nome: store.name,
                produto: displayPromoProductName(o.product_name, store.name),
                preco: o.price,
                categoria: o.category || '',
                promo_image_url: o.promo_image_url,
              };
              return (
                <ProductOfferThumb
                  key={`${store.id}-sp-${String(o.id)}-${i}`}
                  point={point}
                  accentHex={accentHex}
                  priceSlot={priceSlot}
                  compact
                  interactive={Boolean(onStoreOfferCartToggle)}
                  selected={cartOfferIdSet?.has(String(o.id))}
                  onActivate={() => onStoreOfferCartToggle?.(point)}
                />
              );
            })}
          </div>
          {onStoreOfferCartToggle ? (
            <p className="text-[10px] text-emerald-700 font-medium mt-2 px-0.5 leading-snug">
              Toque no card ou em <strong>+ Cesta</strong> para adicionar ao carrinho.
            </p>
          ) : null}
        </div>
      ) : null}

      {!peekOnly &&
      store.tem_oferta_hoje &&
      !hasCardOffers &&
      Array.isArray(store.offer_products) &&
      store.offer_products.length > 0 ? (
        <div className="px-2 pb-1">
          <p className="text-xs font-semibold text-amber-700">Ofertas ativas: {store.offer_count || 0}</p>
          <ul
            className={
              disableInnerProductScroll
                ? 'mt-1 space-y-1 text-xs text-gray-700 pl-4 list-disc pr-1'
                : 'mt-1 max-h-[220px] overflow-y-auto space-y-1 text-xs text-gray-700 pl-4 list-disc pr-1'
            }
            style={{ touchAction: 'pan-y', scrollbarGutter: 'stable' }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={disableInnerProductScroll ? undefined : (e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
          >
            {store.offer_products.map((prod, i) => (
              <li key={`${store.id}-offer-${i}`}>{prod}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {typeof onRequestStoreShop === 'function' && (
        <div className="p-2 pt-1">
          <button
            type="button"
            className="w-full py-2 px-3 rounded-lg bg-[#2ECC49] text-white text-xs font-semibold hover:bg-[#22a83a] shadow-sm"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onRequestStoreShop(store);
            }}
          >
            Ver promoções / Montar cesta
          </button>
        </div>
      )}
    </div>
  );
}

/** Categoria “de prateleira” para filtro estilo Waze (último segmento após " - "). */
function offerShelfCategory(offer) {
  const c = String(offer.category || '').trim();
  if (!c) return 'Outros';
  const parts = c
    .split(/\s*-\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 1];
  return c;
}

function formatBRLPriceNum(n) {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : parsePriceToNumber(n) ?? 0;
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function promotionEncarteDiscountPct(original, promo) {
  const o = parsePriceToNumber(original);
  const p = parsePriceToNumber(promo);
  if (o == null || p == null || o <= p || o <= 0) return null;
  return Math.round((1 - p / o) * 100);
}

const ENCARTE_CATEGORY_ICONS = {
  Hortifruti: '🥬',
  Carnes: '🥩',
  'Laticínios': '🧀',
  Bebidas: '🍺',
  Mercearia: '🛒',
  Higiene: '🧴',
  Limpeza: '🧹',
  Congelados: '🧊',
  Padaria: '🍞',
  Outros: '📦',
};

function encarteSortKeyValidity(row) {
  const vd = row?.valid_dates;
  if (Array.isArray(vd) && vd.length > 0) {
    return vd.reduce((mx, d) => {
      const s = String(d).slice(0, 10);
      return s > mx ? s : mx;
    }, '0000-00-00');
  }
  const vu = row?.valid_until;
  if (vu != null && vu !== '') return String(vu).slice(0, 10);
  return '9999-12-31';
}

/** Vigência por `valid_dates` (dias específicos) ou `valid_until` (intervalo). */
function EncarteValidityBadge({ row, wazeUi }) {
  const today =
    typeof window !== 'undefined'
      ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
      : '';
  const validDates = row?.valid_dates;
  const validUntil = row?.valid_until;

  if (Array.isArray(validDates) && validDates.length > 0) {
    const norm = validDates.map((d) => String(d).slice(0, 10));
    const isToday = norm.includes(today);
    const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const labels = norm.map((s) => {
      const date = new Date(`${s}T12:00:00`);
      if (Number.isNaN(date.getTime())) return s;
      return `${diasSemana[date.getDay()]} ${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
    });
    const labelStr = labels.join(', ');
    return (
      <span
        className={`inline-block max-w-full truncate rounded-full px-2 py-0.5 text-[10px] font-medium ${
          isToday
            ? wazeUi
              ? 'bg-emerald-900/50 text-emerald-200'
              : 'bg-green-100 text-green-700'
            : wazeUi
              ? 'bg-amber-900/40 text-amber-200'
              : 'bg-yellow-50 text-yellow-700'
        }`}
        title={labelStr}
      >
        {isToday ? '✓ Hoje' : labelStr}
      </span>
    );
  }

  if (validUntil) {
    const d = String(validUntil).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
    const [y, m, day] = d.split('-');
    return (
      <span className={`text-[10px] ${wazeUi ? 'text-amber-300/90' : 'text-amber-800'}`}>
        até {day}/{m}/{y}
      </span>
    );
  }
  return null;
}

/** Linhas de `public.promotions` (store_id + active) no painel ao abrir pin da loja. */
function PromotionEncarteCard({ row, wazeUi, accentHex, selected, onToggle }) {
  const glyph = categoryFallbackGlyph(row.category);
  const orig = parsePriceToNumber(row.original_price);
  const promoRaw = parsePriceToNumber(row.promo_price);
  const club = parsePriceToNumber(row.club_price);
  const promoEffective = firstPositivePriceNumber(row.promo_price, row.club_price, row.price);
  const pctComputed = promotionEncarteDiscountPct(row.original_price, promoEffective);
  const pct =
    row.discount_pct != null && Number.isFinite(Number(row.discount_pct))
      ? Math.round(Number(row.discount_pct))
      : pctComputed;
  const showOrig = orig != null && promoEffective != null && orig > promoEffective;
  const imgUrl = row.product_image_url || row.flyer_image_url;
  const imgSrc = imgUrl ? getMapProductImageSrcForImg(imgUrl) : '';
  const showImg = Boolean(imgSrc && isDisplayableImageUrl(imgUrl));

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle?.();
        }
      }}
      onClick={(e) => {
        e.stopPropagation();
        onToggle?.();
      }}
      className={`relative flex cursor-pointer flex-col overflow-hidden rounded-xl border text-left transition-[box-shadow] ${
        wazeUi ? 'border-[#2a2d3a] bg-[#1a1d27]' : 'border-gray-100 bg-white shadow-sm'
      } ${
        selected
          ? wazeUi
            ? 'shadow-[0_0_18px_rgba(46,204,113,0.25)] ring-2 ring-[#2ecc71] ring-offset-2 ring-offset-[#13161f]'
            : 'shadow-md ring-[3px] ring-[#2ECC49] ring-offset-2 ring-offset-white'
          : ''
      }`}
    >
      {selected ? (
        <span
          className={`absolute left-1.5 top-1.5 z-[2] flex h-6 w-6 items-center justify-center rounded-full shadow-md ${
            wazeUi ? 'bg-[#2ecc71] text-[#0f1117]' : 'bg-[#2ECC49] text-white'
          }`}
          aria-hidden
        >
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
      ) : null}
      {pct != null ? (
        <span
          className="absolute right-1.5 top-1.5 z-[1] rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm"
          style={{ backgroundColor: accentHex }}
        >
          −{pct}%
        </span>
      ) : null}
      <div
        className={`relative flex aspect-[4/3] min-h-[72px] items-center justify-center overflow-hidden text-4xl ${
          wazeUi ? 'bg-[#161922]' : 'bg-gradient-to-br from-gray-100 to-gray-200'
        }`}
      >
        {showImg ? (
          <img
            src={imgSrc || imgUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <span aria-hidden>{glyph}</span>
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col p-2">
        <p
          className={`min-h-[2.75rem] text-[11px] font-semibold leading-snug line-clamp-3 ${
            wazeUi ? 'text-[#f0f0f0]' : 'text-gray-900'
          }`}
          title={row.product_name}
        >
          {row.product_name}
        </p>
        {showOrig ? (
          <p
            className={`mt-0.5 text-[11px] tabular-nums line-through ${
              wazeUi ? 'text-[#666]' : 'text-gray-400'
            }`}
          >
            R$ {formatBRLPriceNum(orig)}
          </p>
        ) : null}
        {club != null &&
        promoRaw != null &&
        club !== promoRaw &&
        promoEffective === promoRaw ? (
          <p className={`mt-0.5 text-[10px] tabular-nums ${wazeUi ? 'text-[#8ab4f8]' : 'text-blue-600'}`}>
            Clube: R$ {formatBRLPriceNum(club)}
          </p>
        ) : null}
        <p className="mt-auto pt-1 text-[13px] font-bold tabular-nums" style={{ color: accentHex }}>
          {promoEffective != null ? (
            `R$ ${formatBRLPriceNum(promoEffective)}`
          ) : (
            <span className="text-[11px] font-normal opacity-80">Preço no encarte</span>
          )}
          {row.unit ? (
            <span className={`ml-1 text-[10px] font-normal ${wazeUi ? 'text-[#888]' : 'text-gray-500'}`}>
              / {row.unit}
            </span>
          ) : null}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <EncarteValidityBadge row={row} wazeUi={wazeUi} />
        </div>
        {row.validity_note ? (
          <p className={`mt-0.5 line-clamp-2 text-[9px] leading-snug ${wazeUi ? 'text-[#888]' : 'text-gray-500'}`}>
            {row.validity_note}
          </p>
        ) : null}
        {row.image_hint ? (
          <p className={`mt-0.5 line-clamp-2 text-[9px] ${wazeUi ? 'text-[#666]' : 'text-gray-400'}`}>{row.image_hint}</p>
        ) : null}
      </div>
    </div>
  );
}

/** Card de oferta no painel escuro “Waze dos Preços” (dados reais da API). */
function WazeOfferCard({ offer, selected, onToggle, accentHex, canConfirmPrice, confirmBusy, onConfirmOffer }) {
  const [imgBroken, setImgBroken] = useState(false);
  const url = offer.promo_image_url;
  const imgSrc = useMemo(() => (url ? getMapProductImageSrcForImg(url) : ''), [url]);

  useEffect(() => {
    setImgBroken(false);
  }, [url]);

  const shelf = promoCategoryBadgeLabel(offer.category);
  const glyph = categoryFallbackGlyph(offer.category);
  const displayName = displayPromoProductName(offer.product_name, offer.store_name);
  const priceNum = numericPriceForSum(offer.price, offer.category, offer.id);
  const showImg = url && isDisplayableImageUrl(url) && !isEncarteOrNonImageUrl(url) && !imgBroken && Boolean(imgSrc || url);
  const seen = getMapOfferSeenPresentation(offer.observed_at);

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`relative cursor-pointer rounded-xl border border-[#2a2d3a] bg-[#1a1d27] p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
        selected
          ? 'shadow-[0_0_18px_rgba(46,204,113,0.25)] ring-2 ring-[#2ecc71] ring-offset-2 ring-offset-[#13161f]'
          : ''
      }`}
    >
      {priceNum != null && priceNum > 0 ? (
        <div className="absolute right-2 top-2 rounded-full bg-[#2ecc71] px-2 py-0.5 text-[10px] font-bold text-[#0f1117]">
          PROMO
        </div>
      ) : (
        <div className="absolute right-2 top-2 rounded-full bg-[#2a2d3a] px-2 py-0.5 text-[10px] font-semibold text-[#888]">
          Oferta
        </div>
      )}
      {selected ? (
        <div className="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#2ecc71] text-[11px] font-bold text-[#0f1117]">
          ✓
        </div>
      ) : null}
      <div className="mb-1.5 flex min-h-[72px] items-center justify-center overflow-hidden rounded-lg bg-[#161922]">
        {showImg ? (
          <img
            src={imgSrc || url}
            alt=""
            className="finmemory-offer-photo max-h-20 w-full object-cover"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setImgBroken(true)}
          />
        ) : (
          <span className="text-3xl" aria-hidden>
            {glyph}
          </span>
        )}
      </div>
      <p
        className="mb-1 line-clamp-2 text-left text-xs font-semibold leading-snug text-[#f0f0f0]"
        title={offer.product_name}
      >
        {displayName}
      </p>
      {shelf ? <p className="mb-1.5 text-left text-[11px] text-[#888]">{shelf}</p> : null}
      {priceNum != null && priceNum > 0 ? (
        <p className="text-base font-bold tabular-nums" style={{ color: accentHex }}>
          R$ {formatBRLPriceNum(priceNum)}
        </p>
      ) : (
        <p className="text-left text-xs text-[#888]">Preço no encarte / loja</p>
      )}
      {seen.text ? (
        <div className={`mt-1.5 flex items-center gap-0.5 text-[9px] font-medium ${seen.className}`}>
          <Clock className={`h-2.5 w-2.5 shrink-0 ${seen.iconClassName}`} aria-hidden />
          <span>{seen.text}</span>
        </div>
      ) : null}
      {canConfirmPrice && onConfirmOffer ? (
        <button
          type="button"
          disabled={confirmBusy}
          className="mt-1.5 w-full rounded-md border border-[#2a2d3a] bg-[#161922] py-1 text-[9px] font-semibold text-[#9aa0a6] transition-colors hover:border-[#2ecc71] hover:text-[#2ecc71] disabled:opacity-50"
          onClick={(e) => {
            e.stopPropagation();
            onConfirmOffer(offer);
          }}
        >
          {confirmBusy ? '…' : 'Preço ok na loja'}
        </button>
      ) : null}
    </div>
  );
}

/** Hero com carrossel quando há várias fotos; autoplay leve + pontos e setas. */
function HeroOfferCarousel({ sources, storeTitle, count, category = '', dense = false }) {
  const [idx, setIdx] = useState(0);
  const [brokenByUrl, setBrokenByUrl] = useState(() => ({}));
  const categoryGlyph = categoryFallbackGlyph(category);

  const n = sources.length;
  const safeIdx = n ? idx % n : 0;
  const currentUrl = n ? sources[safeIdx] : '';
  const currentImgSrc = useMemo(
    () => (currentUrl ? getMapProductImageSrcForImg(currentUrl) : ''),
    [currentUrl]
  );

  useEffect(() => {
    setIdx(0);
    setBrokenByUrl({});
  }, [sources]);

  useEffect(() => {
    if (n <= 1) return undefined;
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % n);
    }, 5200);
    return () => clearInterval(t);
  }, [n]);

  const markBroken = (url) => {
    setBrokenByUrl((prev) => ({ ...prev, [url]: true }));
    if (n > 1) {
      setIdx((i) => (i + 1) % n);
    }
  };

  const showSlide = currentUrl && !brokenByUrl[currentUrl];

  const go = (delta, e) => {
    e?.stopPropagation();
    e?.preventDefault();
    if (n <= 1) return;
    setIdx((i) => (i + delta + n * 10) % n);
  };

  const heroH = dense ? 'h-[118px]' : 'h-[152px]';
  const dotsBottom = dense ? 'bottom-[40px]' : 'bottom-[52px]';

  return (
    <div
      className={`relative w-full overflow-hidden bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 ${heroH}`}
    >
      {n === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-300/90 to-slate-400/80">
          <span className="text-5xl drop-shadow-sm" aria-hidden>
            {categoryGlyph}
          </span>
        </div>
      )}

      {n > 0 && showSlide && (
        <img
          src={currentImgSrc || currentUrl}
          alt=""
          className="finmemory-offer-photo absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => markBroken(currentUrl)}
        />
      )}

      {n > 0 && !showSlide && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-300/90 to-slate-400/80">
          <span className="text-5xl drop-shadow-sm" aria-hidden>
            {categoryGlyph}
          </span>
          <span className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-white/90">Foto indisponível</span>
        </div>
      )}

      {n > 1 && (
        <>
          <button
            type="button"
            className="absolute left-1.5 top-1/2 z-[2] -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full border border-white/40 bg-black/35 text-lg font-bold text-white shadow-md backdrop-blur-[2px] transition hover:bg-black/50"
            aria-label="Imagem anterior"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => go(-1, e)}
          >
            ‹
          </button>
          <button
            type="button"
            className="absolute right-1.5 top-1/2 z-[2] -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full border border-white/40 bg-black/35 text-lg font-bold text-white shadow-md backdrop-blur-[2px] transition hover:bg-black/50"
            aria-label="Próxima imagem"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => go(1, e)}
          >
            ›
          </button>
          <div
            className={`absolute left-0 right-0 z-[2] flex justify-center gap-1.5 px-8 ${dotsBottom}`}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {sources.map((u, i) => (
              <button
                key={u}
                type="button"
                aria-label={`Ir para imagem ${i + 1}`}
                aria-current={i === safeIdx ? 'true' : undefined}
                className={`h-1.5 rounded-full transition-all ${i === safeIdx ? 'w-5 bg-white shadow-sm' : 'w-1.5 bg-white/45 hover:bg-white/70'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setIdx(i);
                }}
              />
            ))}
          </div>
        </>
      )}

      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 z-[1] bg-gradient-to-t from-black/70 via-black/30 to-transparent px-3 pb-3 ${
          dense ? 'pt-12' : 'pt-20'
        }`}
      >
        <p
          className={`font-bold text-white leading-tight drop-shadow-md line-clamp-2 ${
            dense ? 'text-[13px]' : 'text-[15px]'
          }`}
        >
          {storeTitle}
        </p>
        <p className={`font-medium text-white/90 mt-0.5 ${dense ? 'text-[10px]' : 'text-[11px]'}`}>
          {count} {count === 1 ? 'oferta' : 'ofertas'} em destaque
          {n > 1 ? ` · ${safeIdx + 1}/${n} fotos` : ''}
        </p>
      </div>
    </div>
  );
}

/** Miniatura do produto — imagem real ou placeholder (estilo vitrine). */
function ProductOfferThumb({
  point,
  accentHex,
  priceSlot,
  selected,
  interactive,
  onActivate,
  compact = false,
  canConfirmPrice,
  confirmBusy,
  onConfirmOffer,
}) {
  const [broken, setBroken] = useState(false);
  const url = point.promo_image_url;
  const imgSrc = useMemo(() => (url ? getMapProductImageSrcForImg(url) : ''), [url]);

  useEffect(() => {
    setBroken(false);
  }, [url]);

  const encarteOnly = url && isEncarteOrNonImageUrl(url);
  const tryImage = url && isDisplayableImageUrl(url) && !encarteOnly;
  const fallbackGlyph = categoryFallbackGlyph(point.categoria);
  const displayName = displayPromoProductName(point.produto, point.nome);
  const shelf = promoCategoryBadgeLabel(point.categoria);
  const seen = getMapOfferSeenPresentation(point.observed_at);

  const Wrapper = 'div';
  const wrapProps = interactive
    ? {
        role: 'button',
        tabIndex: 0,
        onClick: (e) => {
          e.stopPropagation();
          onActivate?.();
        },
        onKeyDown: (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onActivate?.();
          }
        },
        onMouseDown: (e) => e.stopPropagation(),
      }
    : {};

  const cardRound = compact ? 'rounded-lg' : 'rounded-xl';
  const ringSel = compact
    ? 'ring-2 ring-[#2ECC49] ring-offset-1 ring-offset-white shadow-md'
    : 'ring-[3px] ring-[#2ECC49] ring-offset-2 ring-offset-white shadow-md';

  return (
    <Wrapper
      {...wrapProps}
      className={`${cardRound} border border-gray-100/90 bg-white shadow-sm overflow-hidden flex flex-col text-left w-full relative transition-[box-shadow] ${
        interactive ? 'cursor-pointer hover:opacity-95' : ''
      } ${selected ? ringSel : ''}`}
    >
      {selected && (
        <span
          className={`absolute z-[2] flex items-center justify-center rounded-full bg-[#2ECC49] text-white shadow-md ${
            compact ? 'top-1 right-1 h-5 w-5' : 'top-1.5 right-1.5 h-6 w-6'
          }`}
          aria-hidden
        >
          <Check className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} strokeWidth={3} />
        </span>
      )}
      <div
        className={
          compact
            ? 'relative h-[72px] w-full shrink-0 bg-gradient-to-br from-gray-100 to-gray-200'
            : 'relative aspect-[4/3] w-full bg-gradient-to-br from-gray-100 to-gray-200'
        }
        style={compact ? undefined : { minHeight: '88px' }}
      >
        {encarteOnly && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute inset-0 z-[1] flex flex-col items-center justify-center bg-gradient-to-br from-amber-100/95 to-amber-200/90 p-2 text-center transition hover:from-amber-50 hover:to-amber-100"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="rounded-full bg-amber-500/95 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow-sm">
              Encarte
            </span>
            <span className="mt-2 text-2xl" aria-hidden>
              📄
            </span>
            <span className="mt-1 text-[9px] font-semibold text-amber-900/90 leading-tight">PDF ou folheto — toque para abrir</span>
          </a>
        )}
        {!encarteOnly && tryImage && !broken && (
          <img
            src={imgSrc || url}
            alt=""
            className="finmemory-offer-photo absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setBroken(true)}
          />
        )}
        {!encarteOnly && (!tryImage || broken) && (
          <div
            className="absolute inset-0 flex items-center justify-center text-lg font-bold text-white"
            style={{
              background: `linear-gradient(135deg, ${accentHex}dd 0%, ${accentHex} 100%)`,
            }}
            aria-hidden
          >
            <span className={compact ? 'text-2xl opacity-95 drop-shadow-sm' : 'text-3xl opacity-95 drop-shadow-sm'}>
              {fallbackGlyph}
            </span>
          </div>
        )}
      </div>
      <div className={`flex flex-col flex-1 min-h-0 ${compact ? 'p-1.5' : 'p-2'}`}>
        <p
          className={`font-semibold text-gray-900 leading-snug ${
            compact ? 'text-[10px] line-clamp-2' : 'text-[11px] line-clamp-3 min-h-[2.75rem]'
          }`}
          title={point.produto}
        >
          {displayName}
        </p>
        {shelf && !compact ? (
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 truncate">
            {shelf}
          </p>
        ) : null}
        <div
          className={`font-bold leading-tight ${compact ? 'mt-1 text-[12px]' : 'mt-auto pt-1.5 text-[12px]'}`}
          style={{ color: accentHex }}
        >
          {priceSlot}
        </div>
        {seen.text ? (
          <div
            className={`mt-1 flex items-center gap-0.5 text-[8px] font-medium leading-tight ${seen.className}`}
          >
            <Clock className={`h-2.5 w-2.5 shrink-0 ${seen.iconClassName}`} aria-hidden />
            <span>{seen.text}</span>
          </div>
        ) : null}
        {canConfirmPrice && onConfirmOffer && point.id != null ? (
          <button
            type="button"
            disabled={confirmBusy}
            className={`w-full rounded-md border border-gray-200 bg-white font-semibold text-gray-600 transition-colors hover:border-emerald-400 hover:text-emerald-700 disabled:opacity-50 ${
              compact ? 'mt-1 py-0.5 text-[8px]' : 'mt-1 py-1 text-[9px]'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              onConfirmOffer();
            }}
          >
            {confirmBusy ? '…' : 'Preço ok'}
          </button>
        ) : null}
        {interactive && onActivate ? (
          <button
            type="button"
            className={`w-full font-bold transition-colors ${
              compact ? 'mt-1.5 rounded-md py-1 text-[10px]' : 'mt-2 rounded-lg py-1.5 text-[11px]'
            } ${
              selected
                ? 'bg-[#2ECC49] text-white hover:bg-[#22a83a]'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              onActivate();
            }}
          >
            {selected ? (compact ? '✓ Remover' : '✓ Na cesta — toque para remover') : '+ Cesta'}
          </button>
        ) : null}
      </div>
    </Wrapper>
  );
}

/** Botões “Como chegar” (Google Maps) + Waze — mesmo padrão visual do Maps (CTA azul + link secundário). */
function MapDirectionsRow({ lat, lng, userOrigin, dense = false, variant = 'light' }) {
  const ok = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
  if (!ok) return null;
  const dest = { lat: Number(lat), lng: Number(lng) };
  const linkClass =
    variant === 'dark'
      ? dense
        ? 'py-1 text-[10px] text-[#8ab4f8] hover:underline'
        : 'py-1.5 text-[11px] text-[#8ab4f8] hover:underline'
      : dense
        ? 'py-1 text-[10px] font-semibold text-[#1a73e8] hover:underline'
        : 'py-1.5 text-[11px] font-semibold text-[#1a73e8] hover:underline';
  return (
    <div className={dense ? 'space-y-1' : 'space-y-1.5'}>
      <button
        type="button"
        className={`flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a73e8] font-semibold text-white shadow-sm hover:bg-[#1557b0] active:bg-[#1557b0] ${
          dense ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm'
        }`}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          openGoogleMapsDirectionsPreferCurrentLocation(dest, userOrigin);
        }}
      >
        <Navigation className={dense ? 'h-4 w-4' : 'h-5 w-5'} strokeWidth={2.25} aria-hidden />
        Como chegar
      </button>
      <button type="button" className={`w-full rounded-lg ${linkClass}`} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); openWazeNavigation(dest); }}>
        Abrir no Waze
      </button>
    </div>
  );
}

/** Barra horizontal estilo Google Maps (mobile): Rotas, Waze, links úteis — scroll lateral. */
function MapShopMobileActionPills({ shopStore, userOrigin, wazeUi }) {
  const lat = Number(shopStore?.lat);
  const lng = Number(shopStore?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const dest = { lat, lng };
  const basePill =
    'shrink-0 inline-flex items-center justify-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold shadow-sm active:scale-[0.98] transition-transform no-underline';
  const googleCls = `${basePill} bg-[#1a73e8] text-white`;
  const secondaryCls = wazeUi
    ? `${basePill} border border-[#2a2d3a] bg-[#1a1d27] text-[#e5e5e5]`
    : `${basePill} border border-gray-200 bg-white text-gray-800`;
  return (
    <div
      data-sheet-pan-x
      className="flex gap-2 overflow-x-auto px-4 pb-2 pt-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x' }}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className={googleCls}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          openGoogleMapsDirectionsPreferCurrentLocation(dest, userOrigin);
        }}
      >
        <Navigation className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
        Rotas
      </button>
      <button
        type="button"
        className={secondaryCls}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          openWazeNavigation(dest);
        }}
      >
        Waze
      </button>
      <Link
        href={shareHref}
        className={secondaryCls}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        Preço diferente
      </Link>
      <Link href="/shopping-list" className={secondaryCls} onMouseDown={(e) => e.stopPropagation()}>
        Lista
      </Link>
    </div>
  );
}

/** Cabeçalho fixo do bottom sheet mobile (pills + tipo + nome + busca + fechar) — fundo #0f0f0f (Nubank-style). */
function MobilePreviewSheetStickyChrome({
  store,
  userOrigin,
  wazeUi,
  onClose,
  offerFilter = '',
  onOfferFilterChange,
}) {
  const pinColor = useMemo(() => getStorePinMainColor(store.type, store.id), [store.type, store.id]);
  const typeChipWaze = wazeUi ? 'border-[#2ECC49]/50 text-[#a7f3d0]' : 'border-emerald-500/40 text-emerald-200';
  const typeChipStyle = wazeUi
    ? undefined
    : { color: pinColor, borderColor: `${pinColor}80` };
  return (
    <div className="px-3 pt-1 pb-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <MapShopMobileActionPills shopStore={store} userOrigin={userOrigin} wazeUi={wazeUi} />
          <p
            className={`mt-1.5 inline-block text-[11px] font-bold border-b-2 pb-0.5 ${typeChipWaze}`}
            style={wazeUi ? undefined : typeChipStyle}
          >
            {storeTypeLabel(store.type)}
          </p>
          <h3 className="mt-0.5 truncate text-sm font-bold text-[#fafafa]">{store.name}</h3>
          {store.address ? (
            <p className="mt-0.5 truncate text-[11px] text-[#9ca3af]">{store.address}</p>
          ) : null}
          <div className="mt-2" data-sheet-no-tap-expand>
            <label className="sr-only" htmlFor="map-preview-offer-filter">
              Filtrar ofertas por nome
            </label>
            <input
              id="map-preview-offer-filter"
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              placeholder="Buscar nesta loja…"
              value={offerFilter}
              onChange={(e) => onOfferFilterChange?.(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="w-full rounded-xl border border-white/[0.1] bg-white/[0.06] px-3 py-2 text-[13px] text-[#fafafa] outline-none ring-0 placeholder:text-[#6b6b6b] focus:border-emerald-500/50 focus:bg-white/[0.09]"
            />
          </div>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-full p-1.5 text-[#e5e5e5] hover:bg-white/10"
          aria-label="Fechar"
          data-sheet-no-tap-expand
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

/**
 * Card estilo “detalhe do lugar” do Google Maps: hero com imagem, título, grelha de ofertas com fotos.
 */
function MapsStyleOfferPopup({ group, accentHex, cartOfferIdSet, onMapPointCartToggle, userOrigin = null }) {
  const first = group.points[0];
  const count = group.points.length;
  const storeTitle = String(group.nome || first?.nome || 'Ofertas').trim();

  const heroSources = useMemo(() => uniqueDisplayableImageUrls(group.points), [group.points]);

  const priced = useMemo(
    () =>
      group.points.filter((p) => {
        const n = Number(p.preco);
        if (String(p.id || '').startsWith('promo-') && (!Number.isFinite(n) || n <= 0.01)) {
          return false;
        }
        return Number.isFinite(n) && n > 0;
      }),
    [group.points]
  );
  const total = priced.reduce((s, p) => s + Number(p.preco), 0);
  const showTotal = priced.length > 1;

  const allPromoIds = group.points.every((pt) => String(pt.id || '').startsWith('promo-'));
  const hasDirections = Number.isFinite(Number(group.lat)) && Number.isFinite(Number(group.lng));

  return (
    <div
      className="finmemory-popup-maps-card text-left select-none"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <HeroOfferCarousel
        sources={heroSources}
        storeTitle={storeTitle}
        count={count}
        category={first?.categoria || ''}
        dense
      />

      {hasDirections ? (
        <div className="px-3 pt-3 pb-1">
          <MapDirectionsRow lat={group.lat} lng={group.lng} userOrigin={userOrigin} />
          <p className="mt-2 text-center text-[10px] leading-snug text-gray-500">
            A rota parte da sua posição (GPS ao tocar em Como chegar, ou do botão Minha localização no mapa).
          </p>
        </div>
      ) : null}

      <div className={`px-3 pb-2 ${hasDirections ? 'pt-1' : 'pt-3'}`}>
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <span
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white shadow-sm"
            style={{ backgroundColor: accentHex }}
          >
            {count === 1
              ? promoCategoryBadgeLabel(first?.categoria) || 'Oferta'
              : `${count} itens`}
          </span>
          {showTotal && (
            <span className="text-[12px] font-semibold text-gray-600 tabular-nums">
              Total R$ {formatBRLPriceNum(total)}
            </span>
          )}
        </div>

        <div
          className="grid grid-cols-2 gap-1.5 max-h-[min(320px,45vh)] overflow-y-auto pr-0.5 -mr-0.5"
          style={{ touchAction: 'pan-y', scrollbarGutter: 'stable' }}
          onMouseDown={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          {group.points.map((p, i) => {
            const priceSlot =
              p.precoLabel != null ? (
                p.precoLabel
              ) : p.promo_image_url ? (
                <a
                  href={p.promo_image_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-emerald-700 font-semibold text-[11px]"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  Ver encarte
                </a>
              ) : (
                <span className="text-gray-500 text-[11px]">Encarte</span>
              );

            return (
              <ProductOfferThumb
                key={p.id || i}
                point={p}
                accentHex={accentHex}
                priceSlot={priceSlot}
                compact
                interactive={Boolean(onMapPointCartToggle)}
                selected={cartOfferIdSet?.has(String(p.id))}
                onActivate={() => onMapPointCartToggle?.(p)}
              />
            );
          })}
        </div>

        {onMapPointCartToggle ? (
          <p className="text-[10px] text-emerald-700 font-medium mt-1.5 px-0.5 leading-snug">
            Toque no card ou em <strong>+ Cesta</strong> para adicionar ao carrinho (abre à direita). Encarte em PDF: use o botão no card.
          </p>
        ) : null}

        {(first?.time_ago || first?.user_label) && count === 1 && (
          <p className="text-[10px] text-gray-500 mt-2.5 px-0.5">
            {[first.time_ago, first.user_label].filter(Boolean).join(' · ')}
          </p>
        )}
        {count > 1 && (
          <p className="text-[10px] text-gray-500 mt-2.5 leading-snug px-0.5">
            {allPromoIds
              ? 'Imagens e preços vêm do site da rede quando disponíveis. Sem foto? Toque em Ver encarte.'
              : 'Preços partilhados pela comunidade FinMemory.'}
          </p>
        )}
      </div>
    </div>
  );
}

/** Pins de preço: rótulos só com zoom alto ou durante busca — mapa menos carregado. */
function PriceMarkersLayer({ groups, searchQuery, cartOfferIdSet, onMapPointCartToggle, userOrigin = null }) {
  return (
    <>
      {groups.map((group) => (
        <PriceGroupMarker
          key={`pg-${group.groupKey}`}
          group={group}
          searchQuery={searchQuery}
          cartOfferIdSet={cartOfferIdSet}
          onMapPointCartToggle={onMapPointCartToggle}
          userOrigin={userOrigin}
        />
      ))}
    </>
  );
}

/** Ícone memoizado + key estável — evita setIcon() e fechamento do popup ao atualizar pontos. */
function PriceGroupMarker({ group, searchQuery, cartOfferIdSet, onMapPointCartToggle, userOrigin = null }) {
  const zoom = useMapZoom();
  const searchActive = searchQuery.trim().length >= 2;
  const showPinLabels = zoom >= MAP_LABEL_MIN_ZOOM || searchActive;

  const first = group.points[0];
  const catMix = useMemo(() => {
    const set = new Set(group.points.map((p) => String(p.categoria || '').trim()).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, 'pt')).join('|');
  }, [group.points]);
  const { main } = getCategoryColor(catMix || first.categoria, first.nome);
  const count = group.points.length;
  const compactPins = useMatchMedia('(max-width: 767px)');

  const groupLogoSrc = useMemo(() => getHomogeneousGroupLogoPinSrc(group), [group]);
  const isOpportunityGroup = useMemo(() => {
    if (!Array.isArray(group?.points) || group.points.length < 2) return false;
    const priced = group.points
      .map((p) => numericPriceForSum(p?.preco, p?.categoria, p?.id))
      .filter((n) => typeof n === 'number' && Number.isFinite(n) && n > 0);
    if (priced.length < 2) return false;
    const min = Math.min(...priced);
    const avg = priced.reduce((s, n) => s + n, 0) / priced.length;
    return min <= avg * 0.82;
  }, [group]);

  const customIcon = useMemo(() => {
    if (groupLogoSrc) {
      return createPriceGroupBrandIcon(main, count, compactPins, groupLogoSrc, isOpportunityGroup);
    }
    return createCategoryIcon(main, count, compactPins, isOpportunityGroup);
  }, [main, count, compactPins, groupLogoSrc, isOpportunityGroup]);
  const priceLabelStyle = useMemo(() => getMapPinOpenAirLabelStyle(main), [main]);

  return (
    <Marker position={[group.lat, group.lng]} icon={customIcon} zIndexOffset={2500}>
      {showPinLabels && (
        <Tooltip
          permanent
          direction="right"
          offset={[14, 0]}
          opacity={1}
          interactive={false}
          className="finmemory-map-label finmemory-map-label--price"
        >
          <span
            className="finmemory-map-label-text finmemory-map-label-text--price"
            style={{
              ...priceLabelStyle,
              display: 'inline-block',
              maxWidth: 'min(260px, 58vw)',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '-0.015em',
              lineHeight: 1.25,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              verticalAlign: 'middle',
            }}
          >
            {priceGroupMapLabel(group)}
          </span>
        </Tooltip>
      )}
      <Popup autoPan={false} className="mapa-precos-popup-agrupado finmemory-popup-price-offers">
        <MapsStyleOfferPopup
          group={group}
          accentHex={main}
          cartOfferIdSet={cartOfferIdSet}
          onMapPointCartToggle={onMapPointCartToggle}
          userOrigin={userOrigin}
        />
      </Popup>
    </Marker>
  );
}

function MissionRouteMarkers({ stops }) {
  if (!Array.isArray(stops) || stops.length === 0) return null;
  return (
    <>
      {stops.map((stop, idx) => (
        <Marker
          key={`mission-stop-${idx + 1}-${Number(stop?.lat).toFixed(5)}-${Number(stop?.lng).toFixed(5)}`}
          position={[Number(stop.lat), Number(stop.lng)]}
          icon={createMissionStopIcon(idx + 1)}
          zIndexOffset={3600}
        >
          <Tooltip direction="top" offset={[0, -16]} opacity={1} interactive={false}>
            Parada {idx + 1}
          </Tooltip>
        </Marker>
      ))}
    </>
  );
}

export default function MapaPrecosLeaflet({
  mapThemeId = 'padrao',
  searchQuery = '',
  promoOnly = false,
  wazeUi = false,
  planningMode = false,
  planningItems = [],
  onPlanningSummaryChange,
  planningActionRequest,
  headerOffsetPx = 56,
  overlayTopPx,
  onDetailOpenChange,
  onDetailExpandedChange,
}) {
  const theme = getMapThemeById(mapThemeId);
  const mapboxToken =
    typeof process !== 'undefined' ? String(process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '').trim() : '';

  const { tileUrl, tileAttribution, tileDetectRetina } = useMemo(() => {
    const t = getMapThemeById(mapThemeId);
    if (t.mapboxStyleId && mapboxToken) {
      return {
        tileUrl: `https://api.mapbox.com/styles/v1/${t.mapboxStyleId}/tiles/256/{z}/{x}/{y}?access_token=${encodeURIComponent(mapboxToken)}`,
        tileAttribution: t.attribution,
        tileDetectRetina: true,
      };
    }
    if (t.mapboxStyleId && !mapboxToken) {
      const fb = MAP_THEMES[0];
      return {
        tileUrl: fb.url,
        tileAttribution: fb.attribution,
        tileDetectRetina: false,
      };
    }
    return {
      tileUrl: t.url,
      tileAttribution: t.attribution || '',
      tileDetectRetina: t.id === 'verde' || t.id === 'waze',
    };
  }, [mapThemeId, mapboxToken]);

  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const [locais, setLocais] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const reloadPointsRef = useRef(() => {});
  const storeReloadRef = useRef(() => {});
  /** Última posição de &quot;Minha localização&quot; — usada como origem nas rotas (padrão Google Maps). */
  const [userMapPosition, setUserMapPosition] = useState(null);
  /** Lojas visíveis no mapa (bounds) — para esconder pin de “N preços” no mesmo sítio do pin da loja. */
  const [storesVisibleOnMap, setStoresVisibleOnMap] = useState([]);

  const [shopOpen, setShopOpen] = useState(false);
  /** Mobile: pré-visualização da loja ao tocar no pin (sem Popup Leaflet), estilo Google Maps. */
  const [mobileStorePreview, setMobileStorePreview] = useState(null);
  const [shopStore, setShopStore] = useState(null);
  const [shopOffers, setShopOffers] = useState([]);
  const [shopPromotions, setShopPromotions] = useState([]);
  /** IDs dos cards da tabela `promotions` selecionados no painel da loja (toggle por toque). */
  const [selectedItems, setSelectedItems] = useState([]);
  const [shopLoading, setShopLoading] = useState(false);
  const [shopErr, setShopErr] = useState('');
  const [budgetCap, setBudgetCap] = useState(50);
  const [savingList, setSavingList] = useState(false);
  const [saveBanner, setSaveBanner] = useState('');
  const [shopFilterCat, setShopFilterCat] = useState('Todos');
  /** Ordenação das linhas `promotions` (encarte) no painel da loja. */
  const [encarteSortBy, setEncarteSortBy] = useState('validade');

  /** Mobile sheet: max-width 767px — bottom sheet com detents half (~35%) / full (~95%). */
  const isMobileMapSheet = useMatchMedia('(max-width: 767px)', false);
  const mapPadTop = headerOffsetPx;
  const chromeTop = overlayTopPx != null && overlayTopPx !== undefined ? overlayTopPx : headerOffsetPx;
  const [shopSheetSnap, setShopSheetSnap] = useState('closed');
  /** Padding inferior do Leaflet (área útil) quando a folha da loja cobre o mapa no mobile. */
  const [mobileShopSheetMapBottomPadPx, setMobileShopSheetMapBottomPadPx] = useState(0);
  /** Preview do pin (folha pequena antes de abrir a loja). */
  const [previewSheetMapBottomPadPx, setPreviewSheetMapBottomPadPx] = useState(0);
  /** Incrementa para disparar pan suave na janela útil (folha + padding). */
  const [mapUsefulPanTick, setMapUsefulPanTick] = useState(0);
  const [previewSheetSnap, setPreviewSheetSnap] = useState('half');
  /** Filtro de ofertas no bottom sheet mobile (nome do produto). */
  const [previewOfferFilter, setPreviewOfferFilter] = useState('');
  /** Desktop: largura da sidebar à esquerda (padding no Leaflet) — estilo Google Maps. */
  const [desktopSidebarHoverPulse, setDesktopSidebarHoverPulse] = useState(false);
  const {
    shoppingBag,
    shoppingBagTotals,
    groupedByStore,
    setSelectedProducts,
    removeSelectedProduct,
    toggleSelectedProduct,
  } = useMapCart();
  const promoCart = shoppingBag;
  const [bagSheetOpen, setBagSheetOpen] = useState(false);
  const [routePickerOpen, setRoutePickerOpen] = useState(false);
  const [nearbyBagAlert, setNearbyBagAlert] = useState(null);
  const [suggestionIntentReady, setSuggestionIntentReady] = useState(false);
  const [activeSuggestionStore, setActiveSuggestionStore] = useState(null);
  const bagAlertCooldownRef = useRef(new Map());
  useBagBackgroundMonitoring(promoCart);

  useLayoutEffect(() => {
    if (shopOpen) setShopSheetSnap('peek');
    else setShopSheetSnap('closed');
  }, [shopOpen]);

  useEffect(() => {
    if (mobileStorePreview) setPreviewSheetSnap('half');
  }, [mobileStorePreview]);

  useEffect(() => {
    if (promoCart.length === 0) setBagSheetOpen(false);
  }, [promoCart.length]);

  const isDetailOpen = shopOpen || Boolean(mobileStorePreview);
  useEffect(() => {
    if (typeof onDetailOpenChange === 'function') {
      onDetailOpenChange(isDetailOpen);
    }
    return () => {
      if (typeof onDetailOpenChange === 'function') onDetailOpenChange(false);
    };
  }, [isDetailOpen, onDetailOpenChange]);

  const isDetailExpanded =
    (isMobileMapSheet && shopOpen && shopSheetSnap === 'full') ||
    (isMobileMapSheet && !shopOpen && Boolean(mobileStorePreview) && previewSheetSnap === 'full');
  useEffect(() => {
    if (typeof onDetailExpandedChange === 'function') {
      onDetailExpandedChange(Boolean(isDetailExpanded));
    }
    return () => {
      if (typeof onDetailExpandedChange === 'function') onDetailExpandedChange(false);
    };
  }, [isDetailExpanded, onDetailExpandedChange]);

  useEffect(() => {
    setPreviewOfferFilter('');
  }, [mobileStorePreview?.id]);

  const handleShopSheetSnapChange = useCallback((next) => {
    setShopSheetSnap(next);
  }, []);

  const handleShopSheetVisualMetrics = useCallback((m) => {
    setMobileShopSheetMapBottomPadPx(Math.max(0, Math.round(Number(m?.bottomInsetPx) || 0)));
    if (typeof m?.snap === 'string') {
      // EstablishmentDetailSheet não usa onSnapChange externo; capturamos o snap por métricas.
      setShopSheetSnap(m.snap);
    }
  }, []);

  useEffect(() => {
    if (!shopOpen || !isMobileMapSheet) setMobileShopSheetMapBottomPadPx(0);
  }, [shopOpen, isMobileMapSheet]);

  const handlePreviewSheetVisualMetrics = useCallback((m) => {
    setPreviewSheetMapBottomPadPx(Math.max(0, Math.round(Number(m?.bottomInsetPx) || 0)));
  }, []);

  useEffect(() => {
    if (!mobileStorePreview || !isMobileMapSheet) setPreviewSheetMapBottomPadPx(0);
  }, [mobileStorePreview, isMobileMapSheet]);

  useEffect(() => {
    if (!shopOpen || isMobileMapSheet) setDesktopSidebarHoverPulse(false);
  }, [shopOpen, isMobileMapSheet]);

  /** Pan na janela útil só ao abrir a folha da loja (evita mover o mapa ao mexer na lista). */
  useEffect(() => {
    if (!shopOpen || !shopStore?.id) return undefined;
    let cancelled = false;
    const t = window.setTimeout(() => {
      if (!cancelled) setMapUsefulPanTick((n) => n + 1);
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [shopOpen, shopStore?.id]);

  /** Pan só ao abrir o preview do pin (não a cada resize / mudança de snap). */
  useEffect(() => {
    if (!isMobileMapSheet || shopOpen || !mobileStorePreview?.id) return undefined;
    let cancelled = false;
    const t = window.setTimeout(() => {
      if (!cancelled) setMapUsefulPanTick((n) => n + 1);
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [isMobileMapSheet, shopOpen, mobileStorePreview?.id]);

  const onPreviewSheetSnapChange = useCallback((next) => {
    if (next === 'closed') setMobileStorePreview(null);
    else setPreviewSheetSnap(next);
  }, []);


  /**
   * none = área visível; product = busca global por texto de produto/loja;
   * region = aguardando fitBounds (MapRegionFly); depois volta a none.
   */
  const [mapSearchIntent, setMapSearchIntent] = useState({ type: 'none' });
  const mapSearchResolveGenRef = useRef(0);

  useEffect(() => {
    const t = (searchQuery || '').trim();
    const gen = ++mapSearchResolveGenRef.current;
    if (t.length < 2) {
      setMapSearchIntent({ type: 'none' });
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/map/geocode-region?q=${encodeURIComponent(t)}`);
      const data = await res.json().catch(() => ({}));
      if (cancelled || gen !== mapSearchResolveGenRef.current) return;
      if (data.ok && data.bbox) {
        setMapSearchIntent({
          type: 'region',
          bbox: data.bbox,
          center: data.center,
          label: data.label,
        });
      } else {
        setMapSearchIntent({ type: 'product', q: t });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchQuery]);

  const handleRegionFitted = useCallback(() => {
    setMapSearchIntent({ type: 'none' });
  }, []);

  const mapContainerStyle = useMemo(
    () => ({ height: '100%', width: '100%', paddingTop: `${mapPadTop}px` }),
    [mapPadTop]
  );

  /** Em busca por região (bairro/cidade), não filtrar o texto “Grajaú” nos nomes de produto. */
  const applyProductTextFilter = mapSearchIntent.type === 'product';

  /** Pins visíveis: busca de produto + opcional “só promoções” + filtro por loja. */
  const visibleLocais = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let base = locais.filter((p) => !Number.isNaN(p.lat) && !Number.isNaN(p.lng));
    if (promoOnly) {
      base = base.filter(isPromoPoint);
    }
    if (planningMode && Array.isArray(planningItems) && planningItems.length > 0) {
      const terms = planningItems
        .map((v) =>
          String(v || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/\p{M}/gu, '')
            .trim()
        )
        .filter((v) => v.length >= 2);
      if (terms.length > 0) {
        base = base.filter((p) => {
          const h = `${p.produto || ''} ${p.nome || ''} ${p.categoria || ''}`
            .toLowerCase()
            .normalize('NFD')
            .replace(/\p{M}/gu, '');
          return terms.some((term) => h.includes(term));
        });
      }
    }
    if (!applyProductTextFilter || q.length < 2) return base;
    return base.filter(
      (p) =>
        (p.produto || '').toLowerCase().includes(q) ||
        (p.nome || '').toLowerCase().includes(q) ||
        (p.categoria || '').toLowerCase().includes(q)
    );
  }, [locais, searchQuery, promoOnly, applyProductTextFilter]);

  const priceGroups = useMemo(() => groupPointsByLocation(visibleLocais), [visibleLocais]);

  const planningSummary = useMemo(() => {
    if (!planningMode || !Array.isArray(planningItems) || planningItems.length === 0) return null;
    const normalize = (v) =>
      String(v || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .trim();
    const terms = planningItems.map(normalize).filter((v) => v.length >= 2);
    if (terms.length === 0) return null;

    const points = (visibleLocais || []).filter((p) => Number.isFinite(parsePriceToNumber(p.preco)));
    if (points.length === 0) {
      return {
        itemsCount: terms.length,
        matchedItems: 0,
        cheapest: null,
        oneStore: null,
      };
    }

    const pointMatchesTerm = (p, term) =>
      normalize(`${p.produto || ''} ${p.nome || ''} ${p.categoria || ''}`).includes(term);

    // Estratégia 1: menor total (pode combinar múltiplos mercados)
    const cheapestByTerm = [];
    for (const term of terms) {
      const matches = points
        .filter((p) => pointMatchesTerm(p, term))
        .map((p) => ({ ...p, priceNum: parsePriceToNumber(p.preco) }))
        .filter((p) => Number.isFinite(p.priceNum))
        .sort((a, b) => a.priceNum - b.priceNum);
      if (matches.length > 0) cheapestByTerm.push(matches[0]);
    }
    const cheapestTotal = cheapestByTerm.reduce((acc, p) => acc + Number(p.priceNum || 0), 0);
    const cheapestStores = new Set(cheapestByTerm.map((p) => String(p.nome || '').trim()).filter(Boolean));

    // Estratégia 2: tudo em um lugar (score híbrido: cobertura + proximidade + preço + exclusividade)
    const byStore = new Map();
    for (const p of points) {
      const key = String(p.nome || '').trim() || 'Loja';
      if (!byStore.has(key)) byStore.set(key, []);
      byStore.get(key).push(p);
    }
    const termStoreCount = new Map();
    for (const term of terms) {
      let count = 0;
      for (const storePoints of byStore.values()) {
        const hasTerm = storePoints.some((p) => pointMatchesTerm(p, term));
        if (hasTerm) count += 1;
      }
      termStoreCount.set(term, count);
    }
    const userLat = Number(userMapPosition?.lat);
    const userLng = Number(userMapPosition?.lng);
    const userHasLocation = Number.isFinite(userLat) && Number.isFinite(userLng);
    let oneStoreBest = null;
    let qualityBest = null;
    const oneStoreCandidates = [];
    for (const [storeName, storePoints] of byStore.entries()) {
      const chosen = [];
      for (const term of terms) {
        const match = storePoints
          .filter((p) => pointMatchesTerm(p, term))
          .map((p) => ({ ...p, priceNum: parsePriceToNumber(p.preco) }))
          .filter((p) => Number.isFinite(p.priceNum))
          .sort((a, b) => a.priceNum - b.priceNum)[0];
        if (match) chosen.push(match);
      }
      if (chosen.length === 0) continue;
      const total = chosen.reduce((acc, p) => acc + Number(p.priceNum || 0), 0);
      const coveredItems = chosen.length;
      const coverageScore = terms.length > 0 ? coveredItems / terms.length : 0;
      let distanceMeters = null;
      if (userHasLocation) {
        const first = chosen[0];
        const lat = Number(first?.lat);
        const lng = Number(first?.lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          distanceMeters = haversineMeters(userLat, userLng, lat, lng);
        }
      }
      const proximityScore =
        distanceMeters == null
          ? 0.5
          : Math.max(0, Math.min(1, 1 - Math.min(distanceMeters, 5000) / 5000));
      const priceScore =
        cheapestTotal > 0 && coveredItems > 0
          ? Math.max(0, Math.min(1, (cheapestTotal / Math.max(total, 0.01)) * (coveredItems / terms.length)))
          : 0;
      const exclusiveCount = terms.reduce((acc, term) => {
        if (termStoreCount.get(term) === 1 && chosen.some((p) => pointMatchesTerm(p, term))) return acc + 1;
        return acc;
      }, 0);
      const exclusivityScore = terms.length > 0 ? exclusiveCount / terms.length : 0;
      const score = coverageScore * 0.45 + proximityScore * 0.3 + priceScore * 0.2 + exclusivityScore * 0.05;
      const candidate = {
        storeName,
        coveredItems,
        total,
        distanceMeters,
        score,
        priceScore,
        coverageScore,
        exclusivityScore,
        exclusiveCount,
        chosen,
      };
      oneStoreCandidates.push(candidate);
    }
    oneStoreCandidates.sort((a, b) => b.score - a.score || b.coveredItems - a.coveredItems || a.total - b.total);
    if (oneStoreCandidates.length > 0) {
      oneStoreBest = oneStoreCandidates[0];
      const qualitySorted = [...oneStoreCandidates].sort(
        (a, b) =>
          b.exclusiveCount - a.exclusiveCount ||
          b.coverageScore - a.coverageScore ||
          a.distanceMeters - b.distanceMeters ||
          a.total - b.total
      );
      qualityBest = qualitySorted[0] || null;
    }

    return {
      itemsCount: terms.length,
      matchedItems: cheapestByTerm.length,
      cheapest: cheapestByTerm.length
        ? {
            total: Number(cheapestTotal.toFixed(2)),
            storesCount: cheapestStores.size || 1,
            coveredItems: cheapestByTerm.length,
            actionLabel:
              (cheapestStores.size || 1) > 1 ? 'Economia máxima em múltiplos mercados' : 'Economia máxima em loja única',
            badge: (cheapestStores.size || 1) > 1 ? 'Rota de economia' : 'Preço competitivo',
            picks: cheapestByTerm.map((p) => ({
              id: p.id,
              storeName: p.nome || '',
              productName: p.produto || '',
              lat: Number(p.lat),
              lng: Number(p.lng),
              price: Number(p.priceNum || 0),
            })),
          }
        : null,
      oneStore: oneStoreBest
        ? {
            total: Number(oneStoreBest.total.toFixed(2)),
            coveredItems: oneStoreBest.coveredItems,
            storeName: oneStoreBest.storeName,
            score: Number(oneStoreBest.score.toFixed(4)),
            coveragePct: Math.round(oneStoreBest.coverageScore * 100),
            distanceMeters:
              oneStoreBest.distanceMeters == null ? null : Math.round(Number(oneStoreBest.distanceMeters || 0)),
            exclusivesCount: oneStoreBest.exclusiveCount,
            badge:
              oneStoreBest.exclusiveCount > 0
                ? 'Vitrine exclusiva'
                : oneStoreBest.coverageScore >= 0.85
                  ? 'Lista completa'
                  : 'Conveniência',
            actionLabel:
              oneStoreBest.exclusiveCount > 0
                ? 'Encontre itens exclusivos em um só lugar'
                : oneStoreBest.coverageScore >= 0.85
                  ? 'Resolva quase toda a lista sem trocar de mercado'
                  : 'Compra prática perto de você',
          }
        : null,
      quality: qualityBest
        ? {
            storeName: qualityBest.storeName,
            coveredItems: qualityBest.coveredItems,
            total: Number(qualityBest.total.toFixed(2)),
            distanceMeters: qualityBest.distanceMeters == null ? null : Math.round(Number(qualityBest.distanceMeters || 0)),
            exclusivesCount: qualityBest.exclusiveCount,
            badge: qualityBest.exclusiveCount > 0 ? 'Premium/Exclusivos' : 'Curadoria de qualidade',
            actionLabel:
              qualityBest.exclusiveCount > 0
                ? 'Itens exclusivos e diferenciados para sua lista'
                : 'Loja com melhor curadoria para os itens buscados',
          }
        : null,
    };
  }, [planningMode, planningItems, visibleLocais, userMapPosition]);

  useEffect(() => {
    if (typeof onPlanningSummaryChange === 'function') {
      onPlanningSummaryChange(planningSummary);
    }
  }, [planningSummary, onPlanningSummaryChange]);

  const { priceGroupsForMarkers, mapPriceCountByStoreId } = useMemo(
    () => mergePriceGroupsOntoNearbyStores(priceGroups, storesVisibleOnMap),
    [priceGroups, storesVisibleOnMap]
  );

  const handleLocationFound = useCallback(() => {
    // Mantido como callback para compatibilidade com <MapCenterOnUser />.
  }, []);

  const handleRequestStoreShop = useCallback((store) => {
    setSuggestionIntentReady(true);
    setActiveSuggestionStore({
      storeId: store?.id || null,
      placeId: store?.place_id || null,
      storeName: store?.name || null,
      lat: Number(store?.lat),
      lng: Number(store?.lng),
      source: 'store_pin',
      updatedAt: Date.now(),
    });
    setMobileStorePreview(null);
    setShopStore(store);
    setShopOpen(true);
    setShopFilterCat('Todos');
    setEncarteSortBy('validade');
    setShopLoading(true);
    setShopErr('');
    setShopOffers([]);
    setShopPromotions([]);
    setSelectedItems([]);
    setSelectedProducts((prev) => prev.filter((x) => !String(x.offerId || x.id).startsWith('encarte-')));
    fetch(`/api/map/store-offers?store_id=${encodeURIComponent(store.id)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Erro ao carregar ofertas');
        setShopOffers(Array.isArray(data.offers) ? data.offers : []);
        setShopPromotions(Array.isArray(data.promotions) ? data.promotions : []);
        if (data.store && typeof data.store === 'object') {
          setShopStore((prev) =>
            prev && prev.id === store.id ? { ...prev, ...data.store } : prev
          );
        }
      })
      .catch((e) => setShopErr(e.message || 'Erro ao carregar ofertas'))
      .finally(() => setShopLoading(false));
  }, []);

  const handleMobileStorePinOpen = useCallback((store) => {
    handleRequestStoreShop(store);
  }, [handleRequestStoreShop]);

  const [confirmOfferBusyId, setConfirmOfferBusyId] = useState(null);

  const handleOfferConfirmed = useCallback(
    async (offer) => {
      if (!shopStore?.id || !offer?.id) return;
      if (!session?.user?.email) {
        toast.error('Faça login para confirmar o preço na loja.');
        return;
      }
      setConfirmOfferBusyId(String(offer.id));
      try {
        const res = await fetch('/api/map/confirm-offer-seen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ offerId: offer.id, storeId: shopStore.id }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Não foi possível confirmar');
        const iso = data.observed_at || new Date().toISOString();
        setShopOffers((prev) =>
          prev.map((o) =>
            String(o.id) === String(offer.id) ? { ...o, observed_at: iso, time_ago: 'Agora' } : o
          )
        );
        if (data.awarded && data.xp_awarded) {
          toast.success(`+${data.xp_awarded} XP — Obrigado por colaborar!`);
        } else if (data.reason === 'already_today') {
          toast.message('Você já confirmou esta oferta hoje. Valeu!');
        } else {
          toast.success('Obrigado! A data do preço foi atualizada para todos.');
        }
      } catch (e) {
        toast.error(e?.message || 'Erro ao confirmar');
      } finally {
        setConfirmOfferBusyId(null);
      }
    },
    [session?.user?.email, shopStore?.id]
  );

  const toggleSelectedPromotionItem = useCallback(
    (rowOrId) => {
      const row =
        rowOrId && typeof rowOrId === 'object'
          ? rowOrId
          : shopPromotions.find((r) => String(r.id) === String(rowOrId));
      if (!row) return;
      const sid = String(row.id);
      const cartId = `encarte-${sid}`;
      setSelectedItems((prevSel) => {
        const wasOn = prevSel.includes(sid);
        setSelectedProducts((prevCart) => {
          if (wasOn) return prevCart.filter((x) => (x.offerId || x.id) !== cartId);
          if (prevCart.some((x) => (x.offerId || x.id) === cartId)) return prevCart;
          const cat = row.category || 'Supermercado - Promoção';
          const resolved = firstPositivePriceNumber(row.promo_price, row.club_price, row.price);
          const priceNum = numericPriceForSum(resolved, cat, cartId);
          const precoLabel =
            priceNum != null
              ? `R$ ${formatBRLPriceNum(priceNum)}`
              : formatPrecoExibicao(row.promo_price, cat, cartId) ||
                formatPrecoExibicao(row.club_price, cat, cartId);
          return prevCart.concat({
            id: cartId,
            offerId: cartId,
            name: row.product_name,
            productName: row.product_name,
            price: priceNum,
            placeId: shopStore?.place_id || null,
            storeId: shopStore?.id || null,
            storeGeo:
              Number.isFinite(Number(shopStore?.lat)) && Number.isFinite(Number(shopStore?.lng))
                ? { lat: Number(shopStore.lat), lng: Number(shopStore.lng) }
                : null,
            storeLabel: shopStore?.name || 'Loja',
            storeName: shopStore?.name || 'Loja',
            priceNum,
            precoLabel,
            imageUrl: row.product_image_url || row.flyer_image_url || null,
          });
        });
        if (wasOn) return prevSel.filter((x) => x !== sid);
        return [...prevSel, sid];
      });
    },
    [shopPromotions, shopStore, setSelectedProducts]
  );

  const shopAccent = useMemo(() => {
    if (!shopStore) return '#2ECC49';
    const { main } = getCategoryColor('Supermercado - Promoção', shopStore.name);
    return main;
  }, [shopStore]);

  const desktopShopSidebarWidthPx = useMemo(() => {
    if (shopOpen && !isMobileMapSheet) return 400;
    return 0;
  }, [shopOpen, isMobileMapSheet]);

  const mapOverlayBottomPadPx = useMemo(() => {
    if (shopOpen) {
      return isMobileMapSheet ? mobileShopSheetMapBottomPadPx : 0;
    }
    if (mobileStorePreview && isMobileMapSheet) return previewSheetMapBottomPadPx;
    return 0;
  }, [
    isMobileMapSheet,
    shopOpen,
    mobileStorePreview,
    mobileShopSheetMapBottomPadPx,
    previewSheetMapBottomPadPx,
  ]);

  const desktopSidebarPulseStoreId = useMemo(() => {
    if (!shopOpen || isMobileMapSheet || !desktopSidebarHoverPulse || !shopStore?.id) return null;
    return shopStore.id;
  }, [shopOpen, isMobileMapSheet, desktopSidebarHoverPulse, shopStore?.id]);

  const onDesktopPromoHoverEnter = useCallback(() => setDesktopSidebarHoverPulse(true), []);
  const onDesktopPromoHoverLeave = useCallback(() => setDesktopSidebarHoverPulse(false), []);

  const mapUsefulPanLatLng = useMemo(() => {
    if (shopOpen && shopStore) {
      const la = Number(shopStore.lat);
      const ln = Number(shopStore.lng);
      if (Number.isFinite(la) && Number.isFinite(ln)) return [la, ln];
    }
    if (mobileStorePreview && !shopOpen && isMobileMapSheet) {
      const la = Number(mobileStorePreview.lat);
      const ln = Number(mobileStorePreview.lng);
      if (Number.isFinite(la) && Number.isFinite(ln)) return [la, ln];
    }
    return null;
  }, [isMobileMapSheet, shopOpen, shopStore, mobileStorePreview]);

  const toggleCartOffer = useCallback(
    (offer, storeLabelOverride) => {
      const id = String(offer.id);
      const alreadyInCart = promoCart.some((item) => String(item?.offerId || item?.id) === id);
      const storeLabel = storeLabelOverride || shopStore?.name || 'Loja';
      const resolved = firstPositivePriceNumber(offer?.price, offer?.promo_price, offer?.club_price);
      const rawForFormat =
        resolved != null
          ? resolved
          : offer?.price != null && offer?.price !== ''
            ? offer.price
            : offer?.promo_price != null && offer?.promo_price !== ''
              ? offer.promo_price
              : offer?.club_price;
      const priceNum = numericPriceForSum(resolved, offer.category, offer.id);
      const precoLabel =
        priceNum != null
          ? `R$ ${formatBRLPriceNum(priceNum)}`
          : formatPrecoExibicao(rawForFormat, offer.category, offer.id);
      toggleSelectedProduct({
        id,
        offerId: id,
        name: offer.product_name,
        productName: offer.product_name,
        price: priceNum,
        placeId: shopStore?.place_id || offer?.place_id || null,
        storeId: shopStore?.id || offer?.store_id || null,
        storeGeo:
          Number.isFinite(Number(shopStore?.lat)) && Number.isFinite(Number(shopStore?.lng))
            ? { lat: Number(shopStore.lat), lng: Number(shopStore.lng) }
            : Number.isFinite(Number(offer?.store_lat)) && Number.isFinite(Number(offer?.store_lng))
              ? { lat: Number(offer.store_lat), lng: Number(offer.store_lng) }
              : null,
        storeLabel,
        storeName: storeLabel,
        priceNum,
        precoLabel,
        imageUrl: offer?.promo_image_url || offer?.image_url || null,
      });
      if (!alreadyInCart) {
        setSuggestionIntentReady(true);
        setActiveSuggestionStore({
          storeId: shopStore?.id || offer?.store_id || null,
          placeId: shopStore?.place_id || offer?.place_id || null,
          storeName: storeLabel,
          lat: Number(shopStore?.lat ?? offer?.store_lat),
          lng: Number(shopStore?.lng ?? offer?.store_lng),
          source: 'cart_add',
          updatedAt: Date.now(),
        });
      }
    },
    [promoCart, shopStore, toggleSelectedProduct]
  );

  const toggleCartFromMapPoint = useCallback(
    (p) => {
      toggleCartOffer(
        {
          id: p.id,
          product_name: p.produto,
          category: p.categoria,
          price: p.preco,
          store_id: p.store_id || null,
          place_id: p.place_id || null,
          store_lat: p.lat,
          store_lng: p.lng,
        },
        p.nome
      );
    },
    [toggleCartOffer]
  );

  const cartTotalNumeric = useMemo(
    () => promoCart.reduce((s, x) => s + (typeof x.priceNum === 'number' ? x.priceNum : 0), 0),
    [promoCart]
  );

  const budgetStatusColor = useMemo(() => {
    const t = cartTotalNumeric;
    if (t <= 40) return '#2ECC49';
    if (t <= 50) return '#eab308';
    return '#ef4444';
  }, [cartTotalNumeric]);

  const barWidthPct = useMemo(() => {
    const cap = Math.max(10, Number(budgetCap) || 50);
    return Math.min(100, (cartTotalNumeric / cap) * 100);
  }, [cartTotalNumeric, budgetCap]);

  const cartOfferIdSet = useMemo(() => new Set(promoCart.map((x) => x.offerId || x.id)), [promoCart]);
  const latestCartStoreFocus = useMemo(() => {
    if (!Array.isArray(promoCart) || promoCart.length === 0) return null;
    const last = promoCart[promoCart.length - 1];
    const lat = Number(last?.storeGeo?.lat ?? last?.storeLat ?? last?.lat);
    const lng = Number(last?.storeGeo?.lng ?? last?.storeLng ?? last?.lng);
    return {
      storeId: last?.storeId || null,
      placeId: last?.placeId || null,
      storeName: last?.storeName || last?.storeLabel || null,
      lat,
      lng,
      source: 'cart_latest',
      updatedAt: Date.now(),
    };
  }, [promoCart]);

  const estimatedSavingsTotal = useMemo(() => {
    if (!Array.isArray(locais) || locais.length === 0 || promoCart.length === 0) return 0;
    const refByProduct = new Map();
    locais.forEach((point) => {
      const key = normalizeProductKey(point?.produto || point?.product_name);
      if (!key) return;
      const priceNum = numericPriceForSum(point?.preco, point?.categoria, point?.id);
      if (!(typeof priceNum === 'number' && Number.isFinite(priceNum) && priceNum > 0)) return;
      const prev = refByProduct.get(key) || { min: Number.POSITIVE_INFINITY, sum: 0, count: 0 };
      prev.min = Math.min(prev.min, priceNum);
      prev.sum += priceNum;
      prev.count += 1;
      refByProduct.set(key, prev);
    });
    return promoCart.reduce((acc, item) => {
      const priceNum = Number(item?.priceNum);
      if (!(Number.isFinite(priceNum) && priceNum > 0)) return acc;
      const key = normalizeProductKey(item?.productName || item?.name);
      if (!key) return acc;
      const ref = refByProduct.get(key);
      if (!ref || !Number.isFinite(ref.min)) return acc;
      const fallbackAvg = ref.count > 0 ? ref.sum / ref.count : ref.min;
      const baseline = Math.max(ref.min, fallbackAvg);
      const gain = baseline - priceNum;
      return gain > 0 ? acc + gain : acc;
    }, 0);
  }, [locais, promoCart]);

  const contextualSuggestion = useMemo(() => {
    if (!suggestionIntentReady) return null;
    if (!Array.isArray(visibleLocais) || visibleLocais.length === 0) return null;
    const now = Date.now();
    const preferredStore = latestCartStoreFocus || activeSuggestionStore;
    const hasPreferredStore = Boolean(
      preferredStore?.storeId ||
      preferredStore?.placeId ||
      String(preferredStore?.storeName || '').trim() ||
      (Number.isFinite(preferredStore?.lat) && Number.isFinite(preferredStore?.lng))
    );
    const sameStorePoint = (point) => {
      if (!preferredStore) return true;
      if (preferredStore.storeId && point?.store_id && String(point.store_id) === String(preferredStore.storeId)) {
        return true;
      }
      if (preferredStore.placeId && point?.place_id && String(point.place_id) === String(preferredStore.placeId)) {
        return true;
      }
      const preferredName = String(preferredStore.storeName || '').trim().toLowerCase();
      const pointName = String(point?.nome || '').trim().toLowerCase();
      if (preferredName && pointName && preferredName === pointName) return true;
      if (Number.isFinite(preferredStore?.lat) && Number.isFinite(preferredStore?.lng)) {
        const pLat = Number(point?.lat);
        const pLng = Number(point?.lng);
        if (Number.isFinite(pLat) && Number.isFinite(pLng)) {
          return haversineMeters(preferredStore.lat, preferredStore.lng, pLat, pLng) <= 220;
        }
      }
      return false;
    };
    const candidatePoints = hasPreferredStore ? visibleLocais.filter(sameStorePoint) : visibleLocais;
    if (hasPreferredStore && candidatePoints.length === 0) return null;
    const byProduct = new Map();
    candidatePoints.forEach((point) => {
      const key = normalizeProductKey(point?.produto);
      if (!key) return;
      const priceNum = numericPriceForSum(point?.preco, point?.categoria, point?.id);
      if (!(typeof priceNum === 'number' && Number.isFinite(priceNum) && priceNum > 0)) return;
      const prev = byProduct.get(key) || { min: Number.POSITIVE_INFINITY, sum: 0, count: 0 };
      prev.min = Math.min(prev.min, priceNum);
      prev.sum += priceNum;
      prev.count += 1;
      byProduct.set(key, prev);
    });
    const cartProductKeys = new Set(promoCart.map((item) => normalizeProductKey(item?.productName || item?.name)));
    let best = null;
    candidatePoints.forEach((point) => {
      const offerId = String(point?.id || '');
      if (!offerId || cartOfferIdSet.has(offerId)) return;
      const productKey = normalizeProductKey(point?.produto);
      if (!productKey || cartProductKeys.has(productKey)) return;
      const priceNum = numericPriceForSum(point?.preco, point?.categoria, point?.id);
      if (!(typeof priceNum === 'number' && Number.isFinite(priceNum) && priceNum > 0)) return;
      const ref = byProduct.get(productKey);
      if (!ref || !Number.isFinite(ref.min)) return;
      const baseline = Math.max(ref.min, ref.count > 0 ? ref.sum / ref.count : ref.min);
      const potentialGain = baseline - priceNum;
      if (!(potentialGain > 0.15)) return;
      const observedAtTs = point?.observed_at ? new Date(point.observed_at).getTime() : NaN;
      const freshnessBoost = Number.isFinite(observedAtTs) && now - observedAtTs <= 1000 * 60 * 60 * 8 ? 0.6 : 0;
      const score = potentialGain + freshnessBoost;
      if (!best || score > best.score) {
        best = {
          score,
          offer: point,
          potentialGain,
        };
      }
    });
    return best;
  }, [suggestionIntentReady, visibleLocais, promoCart, cartOfferIdSet, latestCartStoreFocus, activeSuggestionStore]);

  const primaryCtaLabel = promoCart.length > 0 ? 'Ir economizar agora' : 'Lista';

  const missionRoute = useMemo(() => {
    const stops = [];
    const seenStops = new Set();
    promoCart.forEach((item) => {
      const lat = Number(item?.storeGeo?.lat ?? item?.storeLat ?? item?.lat);
      const lng = Number(item?.storeGeo?.lng ?? item?.storeLng ?? item?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const key = `${lat.toFixed(5)}_${lng.toFixed(5)}`;
      if (seenStops.has(key)) return;
      seenStops.add(key);
      stops.push({ lat, lng });
    });
    if (stops.length === 0) return { points: [], totalMeters: 0, etaMin: 0, stops: [] };
    const preferredStopLat = Number(latestCartStoreFocus?.lat);
    const preferredStopLng = Number(latestCartStoreFocus?.lng);
    const preferredStop =
      Number.isFinite(preferredStopLat) && Number.isFinite(preferredStopLng)
        ? stops.find((s) => haversineMeters(s.lat, s.lng, preferredStopLat, preferredStopLng) <= 220) || null
        : null;
    let current =
      userMapPosition && Number.isFinite(Number(userMapPosition.lat)) && Number.isFinite(Number(userMapPosition.lng))
        ? { lat: Number(userMapPosition.lat), lng: Number(userMapPosition.lng) }
        : null;
    const remaining = preferredStop
      ? [preferredStop, ...stops.filter((s) => s !== preferredStop)]
      : stops.slice();
    const route = [];
    const routeStops = [];
    if (current) route.push(current);
    while (remaining.length > 0) {
      if (!current) {
        current = remaining.shift();
        route.push(current);
        continue;
      }
      if (routeStops.length === 0 && preferredStop) {
        route.push(preferredStop);
        routeStops.push(preferredStop);
        current = preferredStop;
        const idx = remaining.findIndex((s) => s === preferredStop);
        if (idx >= 0) remaining.splice(idx, 1);
        continue;
      }
      let nearestIdx = 0;
      let nearestDist = Number.POSITIVE_INFINITY;
      for (let i = 0; i < remaining.length; i += 1) {
        const cand = remaining[i];
        const d = haversineMeters(current.lat, current.lng, cand.lat, cand.lng);
        if (d < nearestDist) {
          nearestDist = d;
          nearestIdx = i;
        }
      }
      const next = remaining.splice(nearestIdx, 1)[0];
      route.push(next);
      routeStops.push(next);
      current = next;
    }
    let totalMeters = 0;
    for (let i = 1; i < route.length; i += 1) {
      totalMeters += haversineMeters(route[i - 1].lat, route[i - 1].lng, route[i].lat, route[i].lng);
    }
    // Velocidade urbana média em deslocamento curto.
    const etaMin = totalMeters > 0 ? Math.max(1, Math.round(totalMeters / 430)) : 0;
    return {
      points: route.map((pt) => [pt.lat, pt.lng]),
      totalMeters,
      etaMin,
      stops: routeStops.length > 0 ? routeStops : stops,
    };
  }, [promoCart, userMapPosition, latestCartStoreFocus]);

  const missionDistanceKm = useMemo(
    () => (missionRoute.totalMeters > 0 ? missionRoute.totalMeters / 1000 : 0),
    [missionRoute.totalMeters]
  );

  const firstMissionStop = missionRoute.stops?.[0] || null;

  const handleStartMissionRoute = useCallback(() => {
    if (!firstMissionStop) {
      toast.message('Selecione ao menos uma parada para iniciar a rota.');
      return;
    }
    trackEvent('rota_iniciada', {
      stops_count: missionRoute.stops?.length || 0,
      estimated_savings: Number(estimatedSavingsTotal || 0),
    });
    void trackBackendEvent('rota_iniciada', '/mapa');
    setRoutePickerOpen(true);
  }, [firstMissionStop, missionRoute.stops, estimatedSavingsTotal]);

  const handleOpenMissionInGoogle = useCallback(async () => {
    if (!firstMissionStop) return;
    openGoogleMapsDirectionsPreferCurrentLocation(
      { lat: firstMissionStop.lat, lng: firstMissionStop.lng },
      userMapPosition || null
    );
    const scheduled = await scheduleMissionFollowupNotification({
      delayMinutes: 30,
      estimatedSavings: estimatedSavingsTotal,
      stopsCount: missionRoute.stops?.length || 0,
    });
    if (scheduled?.ok) {
      trackEvent('push_agendado', {
        source: 'google_maps',
        delay_minutes: 30,
      });
      void trackBackendEvent('push_agendado', '/mapa');
    }
    setRoutePickerOpen(false);
  }, [firstMissionStop, userMapPosition, estimatedSavingsTotal, missionRoute.stops]);

  const handleOpenMissionInWaze = useCallback(async () => {
    if (!firstMissionStop) return;
    openWazeNavigation({ lat: firstMissionStop.lat, lng: firstMissionStop.lng });
    const scheduled = await scheduleMissionFollowupNotification({
      delayMinutes: 30,
      estimatedSavings: estimatedSavingsTotal,
      stopsCount: missionRoute.stops?.length || 0,
    });
    if (scheduled?.ok) {
      trackEvent('push_agendado', {
        source: 'waze',
        delay_minutes: 30,
      });
      void trackBackendEvent('push_agendado', '/mapa');
    }
    setRoutePickerOpen(false);
  }, [firstMissionStop, estimatedSavingsTotal, missionRoute.stops]);

  const handleApplyMoneyPlanningPicks = useCallback(
    (picks) => {
      const normalized = (Array.isArray(picks) ? picks : [])
        .map((p) => {
          const id = String(p?.id || '').trim();
          const lat = Number(p?.lat);
          const lng = Number(p?.lng);
          const price = Number(p?.price);
          if (!id || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
          return {
            id,
            offerId: id,
            name: p?.productName || 'Oferta',
            productName: p?.productName || 'Oferta',
            price: Number.isFinite(price) ? price : null,
            priceNum: Number.isFinite(price) ? price : null,
            precoLabel: Number.isFinite(price) ? `R$ ${formatBRLPriceNum(price)}` : null,
            storeLabel: p?.storeName || 'Loja',
            storeName: p?.storeName || 'Loja',
            storeGeo: { lat, lng },
          };
        })
        .filter(Boolean);
      if (normalized.length === 0) return;
      setSelectedProducts((prev) => {
        const byId = new Map((Array.isArray(prev) ? prev : []).map((x) => [String(x?.offerId || x?.id || ''), x]));
        for (const item of normalized) byId.set(String(item.offerId), item);
        return Array.from(byId.values()).filter((x) => String(x?.offerId || x?.id || '').trim());
      });
      toast.success('Rota sugerida montada com os melhores preços.');
    },
    [setSelectedProducts]
  );

  const isDetailSheetProductInCart = useCallback(
    (product) => {
      if (!product) return false;
      const baseId = String(product.confirmId || product.id || '');
      if (!baseId) return false;
      if (product.cardType === 'encarte') return cartOfferIdSet.has(`encarte-${baseId}`);
      return cartOfferIdSet.has(baseId);
    },
    [cartOfferIdSet]
  );

  const toggleCartFromDetailSheet = useCallback(
    (product) => {
      if (!product) return;
      const pid = String(product.confirmId || product.id || '');
      if (!pid) return;
      if (product.cardType === 'encarte') {
        const row = shopPromotions.find((r) => String(r.id) === pid);
        if (row) {
          toggleSelectedPromotionItem(row);
          return;
        }
      }
      const offer = shopOffers.find((o) => String(o.id) === pid);
      if (offer) {
        toggleCartOffer(offer);
        return;
      }
      const storeLabel = shopStore?.name || 'Loja';
      toggleSelectedProduct({
        id: product.cardType === 'encarte' ? `encarte-${pid}` : pid,
        offerId: product.cardType === 'encarte' ? `encarte-${pid}` : pid,
        name: product.name,
        productName: product.name,
        price: typeof product.price === 'number' ? product.price : null,
        priceNum: typeof product.price === 'number' ? product.price : null,
        precoLabel: typeof product.price === 'number' ? `R$ ${formatBRLPriceNum(product.price)}` : null,
        imageUrl: product.imageUrl || null,
        storeLabel,
        storeName: storeLabel,
        placeId: shopStore?.place_id || null,
        storeId: shopStore?.id || null,
        storeGeo:
          Number.isFinite(Number(shopStore?.lat)) && Number.isFinite(Number(shopStore?.lng))
            ? { lat: Number(shopStore.lat), lng: Number(shopStore.lng) }
            : null,
      });
    },
    [shopPromotions, shopOffers, toggleSelectedPromotionItem, toggleCartOffer, toggleSelectedProduct, shopStore]
  );

  useEffect(() => {
    if (!userMapPosition || promoCart.length === 0) {
      setNearbyBagAlert(null);
      return;
    }
    const radiusMeters = 220;
    const now = Date.now();
    let best = null;
    for (const item of promoCart) {
      const storeGeo = item?.storeGeo;
      if (!storeGeo || !Number.isFinite(storeGeo.lat) || !Number.isFinite(storeGeo.lng)) continue;
      const distance = haversineMeters(
        Number(userMapPosition.lat),
        Number(userMapPosition.lng),
        Number(storeGeo.lat),
        Number(storeGeo.lng)
      );
      if (distance > radiusMeters) continue;
      if (!best || distance < best.distance) {
        best = { item, distance };
      }
    }
    if (!best) {
      setNearbyBagAlert(null);
      return;
    }

    const alertKey = `${best.item.id}:${best.item.storeName || best.item.storeLabel}`;
    const lastTs = bagAlertCooldownRef.current.get(alertKey) || 0;
    if (now - lastTs > 120000) {
      bagAlertCooldownRef.current.set(alertKey, now);
      const priceLabel =
        typeof best.item.priceNum === 'number'
          ? `R$ ${formatBRLPriceNum(best.item.priceNum)}`
          : best.item.precoLabel || 'preço atualizado';
      toast.message(
        `Você está perto de ${best.item.storeName || best.item.storeLabel}. ${best.item.productName || best.item.name} por ${priceLabel}.`
      );
    }
    setNearbyBagAlert(best);
  }, [promoCart, userMapPosition]);

  const selectedPromotionRowsOrdered = useMemo(() => {
    const byId = new Map(shopPromotions.map((r) => [String(r.id), r]));
    return selectedItems.map((id) => byId.get(id)).filter(Boolean);
  }, [selectedItems, shopPromotions]);

  const selectedEncarteTotal = useMemo(
    () =>
      selectedPromotionRowsOrdered.reduce((s, r) => {
        const n = firstPositivePriceNumber(r.promo_price, r.club_price, r.price);
        return s + (typeof n === 'number' ? n : 0);
      }, 0),
    [selectedPromotionRowsOrdered]
  );

  const encarteBudgetBarColor = useMemo(() => {
    const t = selectedEncarteTotal;
    if (t <= 40) return '#2ECC49';
    if (t <= 50) return '#eab308';
    return '#ef4444';
  }, [selectedEncarteTotal]);

  const encarteBarWidthPct = useMemo(() => {
    const cap = 50;
    return Math.min(100, (selectedEncarteTotal / cap) * 100);
  }, [selectedEncarteTotal]);

  const shopShelfCategories = useMemo(() => {
    const set = new Set();
    for (const o of shopOffers) {
      set.add(offerShelfCategory(o));
    }
    for (const r of shopPromotions) {
      const c = String(r.category || '').trim();
      set.add(c || 'Outros');
    }
    if (set.size === 0) return ['Todos'];
    return ['Todos', ...[...set].sort((a, b) => a.localeCompare(b, 'pt'))];
  }, [shopOffers, shopPromotions]);

  const filteredShopOffers = useMemo(() => {
    if (shopFilterCat === 'Todos') return shopOffers;
    return shopOffers.filter((o) => offerShelfCategory(o) === shopFilterCat);
  }, [shopOffers, shopFilterCat]);

  const sortedShopPromotions = useMemo(() => {
    const rows = [...(shopPromotions || [])];
    const far = '9999-12-31';
    if (encarteSortBy === 'preco') {
      rows.sort((a, b) => (Number(a.promo_price) || 0) - (Number(b.promo_price) || 0));
    } else if (encarteSortBy === 'nome') {
      rows.sort((a, b) => String(a.product_name || '').localeCompare(String(b.product_name || ''), 'pt-BR'));
    } else if (encarteSortBy === 'imagem') {
      rows.sort((a, b) => {
        const sa = a.product_image_url || a.flyer_image_url ? 0 : 1;
        const sb = b.product_image_url || b.flyer_image_url ? 0 : 1;
        if (sa !== sb) return sa - sb;
        return String(a.product_name || '').localeCompare(String(b.product_name || ''), 'pt-BR');
      });
    } else {
      rows.sort((a, b) => {
        const va = encarteSortKeyValidity(a) || far;
        const vb = encarteSortKeyValidity(b) || far;
        const c = va.localeCompare(vb);
        if (c !== 0) return c;
        return (Number(a.promo_price) || 0) - (Number(b.promo_price) || 0);
      });
    }
    return rows;
  }, [shopPromotions, encarteSortBy]);

  const filteredShopPromotions = useMemo(() => {
    if (shopFilterCat === 'Todos') return sortedShopPromotions;
    return sortedShopPromotions.filter(
      (r) => String(r.category || '').trim() === shopFilterCat
    );
  }, [sortedShopPromotions, shopFilterCat]);

  const latestOfferObservedAt = useMemo(() => {
    let latest = null;
    for (const o of shopOffers) {
      const d = o?.observed_at ? new Date(o.observed_at) : null;
      if (!d || Number.isNaN(d.getTime())) continue;
      if (!latest || d > latest) latest = d;
    }
    return latest;
  }, [shopOffers]);

  const latestOfferObservedLabel = useMemo(() => {
    if (!latestOfferObservedAt) return '';
    return latestOfferObservedAt.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [latestOfferObservedAt]);

  const handleSaveShoppingList = useCallback(async () => {
    setSaveBanner('');
    const userId =
      session?.user?.supabaseId ||
      (typeof window !== 'undefined' ? window.localStorage.getItem('user_id') : null);
    if (!userId) {
      setSaveBanner('Faça login para salvar na lista.');
      return;
    }
    if (promoCart.length === 0) return;
    const supabase = getSupabase();
    if (!supabase) {
      setSaveBanner('Não foi possível conectar.');
      return;
    }
    setSavingList(true);
    try {
      let partnershipId = null;
      const { data: memberRow, error: e1 } = await supabase
        .from('partnership_members')
        .select('partnership_id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();
      if (!e1 && memberRow) {
        const { data: p, error: e2 } = await supabase
          .from('partnerships')
          .select('id')
          .eq('id', memberRow.partnership_id)
          .eq('status', 'active')
          .maybeSingle();
        if (!e2 && p) partnershipId = p.id;
      }
      const itemsPayload = promoCart.map(
        ({ offerId, productName, storeLabel, priceNum, precoLabel }) => ({
          offerId: String(offerId),
          productName,
          storeLabel,
          priceNum: typeof priceNum === 'number' && Number.isFinite(priceNum) ? priceNum : null,
          precoLabel: precoLabel || null,
        })
      );
      const total = itemsPayload.reduce(
        (s, x) => s + (typeof x.priceNum === 'number' ? x.priceNum : 0),
        0
      );
      const { data: listRow, error: insErr } = await supabase
        .from('shopping_lists')
        .insert({
          partnership_id: partnershipId,
          owner_user_id: userId,
          created_by: userId,
          total,
          items: itemsPayload,
        })
        .select('id')
        .single();
      if (insErr) throw insErr;
      const groupId = listRow?.id;
      if (groupId) {
        const rows = promoCart.map(({ offerId, productName, storeLabel, priceNum, precoLabel }) => ({
          partnership_id: partnershipId,
          owner_user_id: userId,
          added_by: userId,
          name: productName || 'Item',
          quantity: 1,
          source_type: 'map',
          unit_price: typeof priceNum === 'number' && Number.isFinite(priceNum) ? priceNum : null,
          price_label: precoLabel || null,
          store_label: storeLabel || null,
          map_offer_id: offerId != null ? String(offerId) : null,
          shopping_list_group_id: groupId,
        }));
        const { error: itemsErr } = await supabase.from('shopping_list_items').insert(rows);
        if (itemsErr) {
          await supabase.from('shopping_lists').delete().eq('id', groupId);
          throw itemsErr;
        }
      }
      setSelectedProducts([]);
      router.push('/shopping-list');
    } catch (e) {
      setSaveBanner(e.message || 'Não foi possível salvar.');
    } finally {
      setSavingList(false);
    }
  }, [session, promoCart, router, setSelectedProducts]);

  /** Atualização periódica só com aba visível (mapa mais “vivo” sem custo em background). */
  useEffect(() => {
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        reloadPointsRef.current?.();
        storeReloadRef.current?.();
      }
    }, 50000);
    return () => clearInterval(id);
  }, []);

  /** Realtime: Quick Add / bots inserem price_points → atualiza pontos e lojas sem mover o mapa. */
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return undefined;
    const ch = sb
      .channel('map_store_refresh')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'price_points' }, () => {
        reloadPointsRef.current?.();
        storeReloadRef.current?.();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stores' }, () => {
        storeReloadRef.current?.();
      })
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, []);

  /** Ao voltar para a aba (ex.: após Quick Add em outra página), recarrega pins e lojas imediatamente. */
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        reloadPointsRef.current?.();
        storeReloadRef.current?.();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const mapBlockInteraction =
    isMobileMapSheet && shopOpen && shopSheetSnap === 'expanded';

  return (
    <div
      className={`relative h-full w-full ${
        mapBlockInteraction ? '[&_.leaflet-container]:pointer-events-none' : ''
      }`}
    >
      <MapContainer
        center={DEFAULT_MAP_CENTER}
        zoom={DEFAULT_MAP_ZOOM}
        zoomControl={false}
        style={mapContainerStyle}
        className={`z-0 finmemory-map-tiles finmemory-map-theme-${theme.id}`}
      >
        <TileLayer
          attribution={
            tileAttribution ||
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; CARTO'
          }
          url={tileUrl}
          detectRetina={tileDetectRetina}
        />
        <LocationMarker
          onLocationFound={handleLocationFound}
          onUserPositionChange={(lat, lng) => setUserMapPosition({ lat, lng })}
          headerOffsetPx={chromeTop}
        />
        <MapRegionFly
          searchQuery={searchQuery}
          searchIntent={mapSearchIntent}
          onRegionFitted={handleRegionFitted}
        />
        <PricePointsLoader
          searchIntent={mapSearchIntent}
          setLocais={setLocais}
          setCarregando={setCarregando}
          reloadRef={reloadPointsRef}
        />
        {/* Preços primeiro; lojas depois + z-index maior — evita círculos de promo cobrirem estabelecimentos */}
        <PriceMarkersLayer
          groups={priceGroupsForMarkers}
          searchQuery={searchQuery}
          cartOfferIdSet={cartOfferIdSet}
          onMapPointCartToggle={toggleCartFromMapPoint}
          userOrigin={userMapPosition}
        />
        {missionRoute.points.length >= 2 ? (
          <>
            <Polyline
              positions={missionRoute.points}
              pathOptions={{
                color: '#22c55e',
                weight: 9,
                opacity: 0.2,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            <Polyline
              positions={missionRoute.points}
              pathOptions={{
                color: '#2ECC49',
                weight: 4,
                opacity: 0.98,
                dashArray: '10 8',
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </>
        ) : null}
        <MissionRouteMarkers stops={missionRoute.stops} />
        <StoreMarkers
          searchQuery={searchQuery}
          planningMode={planningMode}
          planningItems={planningItems}
          onRequestStoreShop={handleRequestStoreShop}
          userOrigin={userMapPosition}
          cartOfferIdSet={cartOfferIdSet}
          onStoreOfferCartToggle={toggleCartFromMapPoint}
          isMobileMapSheet={isMobileMapSheet}
          onMobileStorePinOpen={handleMobileStorePinOpen}
          onVisibleStoresChange={setStoresVisibleOnMap}
          mapPriceCountByStoreId={mapPriceCountByStoreId}
          pulseStoreId={desktopSidebarPulseStoreId}
          reloadRef={storeReloadRef}
        />
        <MapShopSheetDragLock
          locked={isMobileMapSheet && shopOpen && shopSheetSnap === 'expanded'}
        />
        <MapBottomPaddingSync paddingPx={mapOverlayBottomPadPx} paddingLeftPx={desktopShopSidebarWidthPx} />
        <MapUsefulAreaPan
          latLng={mapUsefulPanLatLng}
          bottomPadPx={mapOverlayBottomPadPx}
          leftPadPx={desktopShopSidebarWidthPx}
          panTick={mapUsefulPanTick}
        />
        <PlanningActionController
          request={planningActionRequest}
          summary={planningSummary}
          storesVisibleOnMap={storesVisibleOnMap}
          onOpenStore={handleRequestStoreShop}
          setMapUsefulPanTick={setMapUsefulPanTick}
          onApplyMoneyPlan={handleApplyMoneyPlanningPicks}
        />
      </MapContainer>

      {nearbyBagAlert ? (
        <div className="pointer-events-none absolute bottom-[9.25rem] left-3 right-3 z-[1102] sm:left-4 sm:right-auto sm:max-w-[360px]">
          <div className="rounded-xl border border-emerald-400/40 bg-[#0f1117]/95 px-3 py-2 text-xs text-emerald-50 shadow-[0_10px_28px_rgba(16,185,129,0.25)] backdrop-blur-md">
            Você está perto de <span className="font-semibold text-emerald-300">{nearbyBagAlert.item.storeName || nearbyBagAlert.item.storeLabel}</span>.{' '}
            <span className="font-medium">{nearbyBagAlert.item.productName || nearbyBagAlert.item.name}</span>{' '}
            {typeof nearbyBagAlert.item.priceNum === 'number'
              ? `por R$ ${formatBRLPriceNum(nearbyBagAlert.item.priceNum)}`
              : 'está disponível aqui'}
            .
          </div>
        </div>
      ) : null}

      {promoCart.length > 0 && !shopOpen && !mobileStorePreview ? (
        <div className="pointer-events-none absolute left-3 right-3 z-[1101] top-[max(74px,env(safe-area-inset-top)+70px)] sm:left-4 sm:right-auto sm:max-w-[390px]">
          <div className="pointer-events-auto rounded-2xl border border-emerald-300/45 bg-[#0f1117]/94 px-3.5 py-3 text-white shadow-[0_14px_32px_rgba(16,185,129,0.35)] backdrop-blur-md">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-300">Dashboard de missao</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.04] px-2 py-1.5">
                <p className="text-[10px] text-emerald-100/80">Economia</p>
                <p className="text-sm font-bold text-emerald-300">R$ {formatBRLPriceNum(estimatedSavingsTotal)}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] px-2 py-1.5">
                <p className="text-[10px] text-emerald-100/80">Distancia</p>
                <p className="text-sm font-bold text-emerald-300">{missionDistanceKm > 0 ? `${missionDistanceKm.toFixed(1)} km` : '—'}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] px-2 py-1.5">
                <p className="text-[10px] text-emerald-100/80">Tempo</p>
                <p className="text-sm font-bold text-emerald-300">{missionRoute.etaMin > 0 ? `${missionRoute.etaMin} min` : '—'}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleStartMissionRoute}
              className="mt-2.5 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-500 px-3 py-2 text-xs font-extrabold text-[#052e16] shadow-[0_10px_18px_rgba(16,185,129,0.35)] hover:from-emerald-300 hover:to-emerald-400"
            >
              Iniciar Rota
            </button>
          </div>
        </div>
      ) : null}

      {!shopOpen && !mobileStorePreview && suggestionIntentReady && contextualSuggestion?.offer ? (
        <div className="absolute bottom-[11.2rem] left-3 right-3 z-[1102] sm:left-4 sm:right-auto sm:max-w-[420px]">
          <div className="rounded-2xl border border-white/15 bg-[#111827]/94 p-3 text-white shadow-[0_14px_26px_rgba(15,23,42,0.35)] backdrop-blur-md">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-300">Proximo passo sugerido</p>
            <p className="mt-1 text-sm leading-snug text-zinc-100">
              <span className="font-semibold">{displayPromoProductName(contextualSuggestion.offer?.produto, contextualSuggestion.offer?.nome)}</span>{' '}
              em <span className="font-medium text-emerald-300">{contextualSuggestion.offer?.nome || 'loja proxima'}</span>.
            </p>
            <p className="mt-1 text-xs text-zinc-300">
              Potencial de economia: <span className="font-semibold text-emerald-300">R$ {formatBRLPriceNum(contextualSuggestion.potentialGain)}</span>
            </p>
            <button
              type="button"
              onClick={() => toggleCartFromMapPoint(contextualSuggestion.offer)}
              className="mt-2.5 inline-flex rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-bold text-[#0f1117] hover:bg-emerald-400"
            >
              Adicionar a rota
            </button>
          </div>
        </div>
      ) : null}

      {routePickerOpen ? (
        <div className="fixed inset-0 z-[1115] bg-black/50 px-4 py-20" onClick={() => setRoutePickerOpen(false)}>
          <div
            className="mx-auto w-full max-w-sm rounded-2xl border border-white/15 bg-[#0f1117] p-4 text-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-bold text-emerald-300">Iniciar rota de economia</p>
            <p className="mt-1 text-xs text-zinc-300">
              Escolha o app para abrir a primeira parada da missao.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleOpenMissionInGoogle}
                className="rounded-xl border border-blue-300/40 bg-blue-500/10 px-3 py-2 text-xs font-bold text-blue-200 hover:bg-blue-500/20"
              >
                Abrir no Google Maps
              </button>
              <button
                type="button"
                onClick={handleOpenMissionInWaze}
                className="rounded-xl border border-sky-300/40 bg-sky-500/10 px-3 py-2 text-xs font-bold text-sky-200 hover:bg-sky-500/20"
              >
                Abrir no Waze
              </button>
            </div>
            <button
              type="button"
              onClick={() => setRoutePickerOpen(false)}
              className="mt-2.5 w-full rounded-xl border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {promoCart.length > 0 && !isMobileMapSheet && (
        <div
          style={{ top: chromeTop }}
          className={`absolute z-[1006] flex w-[min(100vw-1rem,280px)] max-h-[min(70vh,440px)] flex-col rounded-xl shadow-xl backdrop-blur-md ${
            selectedItems.length > 0 ? 'right-2 sm:right-[292px]' : 'right-2'
          } ${
            wazeUi
              ? 'border border-[#1e2130] bg-[#13161f]/98'
              : 'border border-gray-200 bg-white/95'
          }`}
        >
          <div
            className={`flex flex-shrink-0 items-center gap-2 border-b px-3 py-2 ${
              wazeUi ? 'border-[#1e2130]' : 'border-gray-100'
            }`}
          >
            <ShoppingCart className={`h-4 w-4 shrink-0 ${wazeUi ? 'text-[#2ecc71]' : 'text-[#2ECC49]'}`} />
            <span className={`text-sm font-bold ${wazeUi ? 'text-[#f0f0f0]' : 'text-gray-900'}`}>
              Carrinho
            </span>
          </div>
          <div
            className={`finmemory-waze-scroll min-h-0 flex-1 space-y-2 overflow-y-auto px-2 py-2 ${
              wazeUi ? '' : ''
            }`}
          >
            {promoCart.map((line) => (
              <div
                key={line.offerId}
                className={`flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs ${
                  wazeUi ? 'border-b border-[#1a1d27] bg-transparent' : 'bg-gray-50'
                }`}
              >
                <span className={`line-clamp-2 flex-1 ${wazeUi ? 'text-[#e5e5e5]' : 'text-gray-800'}`}>
                  {line.productName}
                </span>
                <span
                  className={`shrink-0 font-semibold tabular-nums ${
                    wazeUi ? 'text-[#2ecc71]' : 'text-gray-700'
                  }`}
                >
                  {line.priceNum != null
                    ? `R$ ${formatBRLPriceNum(line.priceNum)}`
                    : line.precoLabel || '—'}
                </span>
                <button
                  type="button"
                  className={`shrink-0 px-1 font-bold leading-none ${
                    wazeUi ? 'text-[#555] hover:text-red-400' : 'text-red-500 hover:text-red-700'
                  }`}
                  aria-label="Remover"
                  onClick={() => {
                    const oid = String(line.offerId);
                    if (oid.startsWith('encarte-')) {
                      const sid = oid.slice('encarte-'.length);
                      setSelectedItems((s) => s.filter((x) => x !== sid));
                    }
                    removeSelectedProduct(line.offerId || line.id);
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <div
            className={`flex-shrink-0 space-y-2 border-t p-2 ${
              wazeUi ? 'border-[#1e2130] bg-[#111419]' : 'border-gray-100'
            }`}
          >
            <div
              className={`flex justify-between text-xs font-semibold ${
                wazeUi ? 'text-[#888]' : 'text-gray-800'
              }`}
            >
              <span>Total (só itens com preço)</span>
              <span
                className="tabular-nums"
                style={wazeUi ? { color: cartTotalNumeric > 50 ? '#e74c3c' : '#2ecc71' } : undefined}
              >
                R$ {formatBRLPriceNum(cartTotalNumeric)}
              </span>
            </div>
            <div className="space-y-1">
              <div
                className={`flex items-center justify-between gap-2 text-[10px] ${
                  wazeUi ? 'text-[#888]' : 'text-gray-500'
                }`}
              >
                <span>Orçamento (barra)</span>
                <label className="inline-flex items-center gap-1">
                  <span className="sr-only">Teto em reais</span>
                  <span>R$</span>
                  <input
                    type="number"
                    min={10}
                    max={500}
                    value={budgetCap}
                    onChange={(e) => setBudgetCap(Number(e.target.value) || 50)}
                    className={`w-14 rounded border px-1 text-right text-xs ${
                      wazeUi
                        ? 'border-[#2a2d3a] bg-[#1a1d27] text-[#f0f0f0]'
                        : 'border-gray-200 text-gray-800'
                    }`}
                  />
                </label>
              </div>
              <div className={`h-1.5 overflow-hidden rounded-md ${wazeUi ? 'bg-[#1e2130]' : 'bg-gray-200'}`}>
                <div
                  className="h-full rounded-md transition-all duration-300"
                  style={{ width: `${barWidthPct}%`, backgroundColor: budgetStatusColor }}
                />
              </div>
              <p className={`text-[10px] leading-snug ${wazeUi ? 'text-[#555]' : 'text-gray-500'}`}>
                Verde até R$40 · amarelo até R$50 · vermelho se passar (referência fixa).
              </p>
            </div>
            <button
              type="button"
              disabled={savingList || sessionStatus === 'loading'}
              onClick={handleSaveShoppingList}
              className={`w-full rounded-lg py-2 text-xs font-bold transition-colors disabled:opacity-50 ${
                wazeUi
                  ? 'bg-[#2ecc71] text-[#0f1117] hover:bg-[#27ae60]'
                  : 'bg-[#2ECC49] font-semibold text-white hover:bg-[#22a83a]'
              }`}
            >
              {savingList ? 'Salvando…' : 'Salvar lista'}
            </button>
            {saveBanner ? (
              <p className={`text-center text-[10px] ${wazeUi ? 'text-[#ccc]' : 'text-gray-700'}`}>
                {saveBanner}
              </p>
            ) : null}
            <Link
              href="/shopping-list"
              className={`block text-center text-[10px] font-medium underline ${
                wazeUi ? 'text-[#2ecc71]' : 'text-emerald-600'
              }`}
            >
              Abrir lista de compras (mapa + anotações)
            </Link>
            <Link
              href="/listas"
              className={`block text-center text-[10px] font-medium underline ${
                wazeUi ? 'text-[#888]' : 'text-gray-500'
              }`}
            >
              Histórico de listas do mapa
            </Link>
          </div>
        </div>
      )}

      {isMobileMapSheet && promoCart.length > 0 ? (
        <FloatingCartBar
          itemsCount={promoCart.length}
          totalPrice={shoppingBagTotals.totalPrice}
          estimatedSavings={estimatedSavingsTotal}
          ctaLabel={primaryCtaLabel}
          onOpenBag={() => setBagSheetOpen(true)}
          onOpenList={() => {
            /* Link no próprio componente */
          }}
        />
      ) : null}

      {isMobileMapSheet && bagSheetOpen && promoCart.length > 0 ? (
        <div className="fixed inset-0 z-[1103] bg-black/45 px-3 pb-6 pt-16" onClick={() => setBagSheetOpen(false)}>
          <div
            className="mx-auto flex h-full max-h-[75dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-emerald-400/40 bg-[#0f1117] text-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div>
                <p className="text-sm font-bold">Sacola de compras</p>
                <p className="text-xs text-emerald-200">
                  {shoppingBagTotals.itemsCount} itens • R$ {formatBRLPriceNum(shoppingBagTotals.totalPrice)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBagSheetOpen(false)}
                className="rounded-lg border border-white/15 px-2 py-1 text-xs text-zinc-200"
              >
                Fechar
              </button>
            </div>
            <div className="finmemory-waze-scroll min-h-0 flex-1 overflow-y-auto px-3 py-3">
              {Object.entries(groupedByStore).map(([storeName, items]) => (
                <section key={storeName} className="mb-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 last:mb-0">
                  <p className="mb-2 text-xs font-semibold text-emerald-300">{storeName}</p>
                  <div className="space-y-1.5">
                    {items.map((item) => (
                      <div key={item.id} className="flex items-start justify-between gap-2 text-xs">
                        <span className="line-clamp-2 flex-1 text-zinc-200">{item.productName || item.name}</span>
                        <span className="shrink-0 font-medium text-emerald-200">
                          {typeof item.priceNum === 'number' ? `R$ ${formatBRLPriceNum(item.priceNum)}` : item.precoLabel || '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
            <div className="border-t border-white/10 px-4 py-3">
              <Link href="/shopping-list" className="block rounded-xl bg-emerald-500 px-3 py-2 text-center text-sm font-bold text-[#0f1117] no-underline">
                Ir para lista completa
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {selectedItems.length > 0 && (
        <aside
          style={{
            top: chromeTop,
            height: `calc(100dvh - ${chromeTop}px)`,
          }}
          className={`fixed right-0 z-[1005] flex w-[min(280px,calc(100vw-0.5rem))] flex-col border-l shadow-[0_0_24px_rgba(0,0,0,0.12)] ${
            wazeUi ? 'border-[#2a2d3a] bg-[#13161f]' : 'border-gray-200 bg-white'
          }`}
          aria-label="Produtos selecionados do encarte"
        >
          <div
            className={`flex flex-shrink-0 flex-col gap-0.5 border-b px-3 py-2.5 ${
              wazeUi ? 'border-[#1e2130]' : 'border-gray-100'
            }`}
          >
            <h3 className={`text-sm font-bold ${wazeUi ? 'text-[#f0f0f0]' : 'text-gray-900'}`}>
              Seleção (encarte)
            </h3>
            <p className={`text-[11px] ${wazeUi ? 'text-[#888]' : 'text-gray-500'}`}>
              {selectedPromotionRowsOrdered.length} item(ns)
            </p>
          </div>
          <div
            className={`finmemory-waze-scroll min-h-0 flex-1 space-y-2 overflow-y-auto px-2 py-2 ${
              wazeUi ? '' : ''
            }`}
          >
            {selectedPromotionRowsOrdered.map((row) => {
              const selEff = firstPositivePriceNumber(row.promo_price, row.club_price, row.price);
              return (
              <div
                key={row.id}
                className={`flex items-start gap-2 rounded-lg px-2 py-2 text-xs ${
                  wazeUi ? 'border border-[#2a2d3a] bg-[#1a1d27]' : 'border border-gray-100 bg-gray-50'
                }`}
              >
                <span
                  className={`min-w-0 flex-1 leading-snug ${wazeUi ? 'text-[#e5e5e5]' : 'text-gray-800'}`}
                  title={row.product_name}
                >
                  {row.product_name}
                </span>
                <span
                  className={`shrink-0 font-semibold tabular-nums ${
                    wazeUi ? 'text-[#2ecc71]' : 'text-emerald-700'
                  }`}
                >
                  {selEff != null ? `R$ ${formatBRLPriceNum(selEff)}` : '—'}
                </span>
                <button
                  type="button"
                  className={`shrink-0 rounded p-0.5 leading-none ${
                    wazeUi ? 'text-[#888] hover:bg-[#2a2d3a] hover:text-red-400' : 'text-gray-500 hover:bg-gray-200 hover:text-red-600'
                  }`}
                  aria-label="Remover da seleção"
                  onClick={() => toggleSelectedPromotionItem(row)}
                >
                  <X className="h-4 w-4" strokeWidth={2.5} />
                </button>
              </div>
              );
            })}
          </div>
          <div
            className={`flex flex-shrink-0 flex-col gap-2 border-t p-3 ${
              wazeUi ? 'border-[#1e2130] bg-[#111419]' : 'border-gray-100 bg-gray-50/80'
            }`}
          >
            <div
              className={`flex items-center justify-between text-sm font-bold ${
                wazeUi ? 'text-[#f0f0f0]' : 'text-gray-900'
              }`}
            >
              <span>Total</span>
              <span className="tabular-nums" style={{ color: encarteBudgetBarColor }}>
                R$ {formatBRLPriceNum(selectedEncarteTotal)}
              </span>
            </div>
            <div className={`h-2 overflow-hidden rounded-full ${wazeUi ? 'bg-[#1e2130]' : 'bg-gray-200'}`}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${encarteBarWidthPct}%`,
                  backgroundColor: encarteBudgetBarColor,
                }}
              />
            </div>
            <p className={`text-[10px] leading-snug ${wazeUi ? 'text-[#666]' : 'text-gray-500'}`}>
              Verde até R$40 · amarelo até R$50 · vermelho acima (referência R$50 na barra).
            </p>
          </div>
        </aside>
      )}

      {wazeUi && !shopOpen && !mobileStorePreview && (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-[999] max-w-[min(92vw,420px)] -translate-x-1/2 px-2">
          <div className="pointer-events-auto rounded-xl border border-[#2a2d3a] bg-[#13161f]/92 px-4 py-3 text-center text-[13px] text-[#888] shadow-lg backdrop-blur-md">
            Toque no pin da loja e use <span className="font-semibold text-[#2ecc71]">Ver promoções / Montar cesta</span>
          </div>
        </div>
      )}

      {mobileStorePreview && isMobileMapSheet && !shopOpen && (
        <MapMobileBottomSheet
          snap={previewSheetSnap}
          onSnapChange={onPreviewSheetSnapChange}
          onVisualMetrics={handlePreviewSheetVisualMetrics}
          wazeUi={wazeUi}
          halfDvh={35}
          fullDvh={95}
          stickyChrome={
            <MobilePreviewSheetStickyChrome
              store={mobileStorePreview}
              userOrigin={userMapPosition}
              wazeUi={wazeUi}
              onClose={() => setMobileStorePreview(null)}
              offerFilter={previewOfferFilter}
              onOfferFilterChange={setPreviewOfferFilter}
            />
          }
        >
          <div className={wazeUi ? 'p-3 pt-0' : 'px-2 pb-2 pt-0'}>
            <div className={wazeUi ? 'rounded-xl bg-white p-2 shadow-sm' : 'contents'}>
              <StoreMarkerOfferPanelBody
                store={mobileStorePreview}
                userOrigin={userMapPosition}
                cartOfferIdSet={cartOfferIdSet}
                onStoreOfferCartToggle={toggleCartFromMapPoint}
                onRequestStoreShop={handleRequestStoreShop}
                hideDirections
                peekOnly={previewSheetSnap === 'half'}
                suppressBuiltInHeader
                disableInnerProductScroll
                offerNameFilter={previewOfferFilter}
                allowRootTouchPropagation
                rootClassName="finmemory-popup-store-offers w-full max-w-full overflow-hidden rounded-lg"
              />
            </div>
          </div>
        </MapMobileBottomSheet>
      )}

      {shopOpen && !isMobileMapSheet ? (
        <aside
          className={`fixed left-0 z-[1004] flex w-[min(400px,92vw)] max-w-full flex-col overflow-hidden rounded-r-2xl border border-l-0 shadow-[4px_0_40px_rgba(0,0,0,0.28)] sm:rounded-r-3xl ${
            wazeUi
              ? 'border-[#2a2d3a] bg-[#13161f]'
              : 'border-gray-200/90 bg-[#0f1117] text-[#e8e8e8] shadow-[4px_0_40px_rgba(0,0,0,0.45)]'
          }`}
          style={{ top: chromeTop, height: `calc(100dvh - ${chromeTop}px)` }}
          aria-label="Detalhes do estabelecimento"
        >
            <div
              className={`flex flex-shrink-0 items-center justify-between px-4 pb-2 pt-3 ${
                wazeUi ? 'border-b border-[#1e2130]' : 'border-b border-white/10'
              }`}
            >
              <div className="min-w-0 pr-2">
                <p className={`text-xs font-semibold ${wazeUi ? 'text-[#888]' : 'text-[#a1a1aa]'}`}>
                  {wazeUi ? 'Waze dos Preços · compra em tempo real' : 'Compra em tempo real'}
                </p>
                <h2 className={`truncate text-lg font-bold ${wazeUi ? 'text-[#f0f0f0]' : 'text-[#fafafa]'}`}>
                  {shopStore?.name}
                </h2>
                {wazeUi && shopStore?.address ? (
                  <p className={`mt-0.5 truncate text-[11px] ${wazeUi ? 'text-[#888]' : 'text-gray-500'}`}>
                    {shopStore.address}
                  </p>
                ) : null}
                {latestOfferObservedLabel ? (
                  <p className={`mt-0.5 text-[11px] ${wazeUi ? 'text-amber-300' : 'text-amber-400/80'}`}>
                    Última atualização no mapa: {latestOfferObservedLabel}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                className={`shrink-0 rounded-full p-2 ${
                  wazeUi ? 'text-[#888] hover:bg-[#1e2130]' : 'text-[#a1a1aa] hover:bg-white/10'
                }`}
                aria-label="Fechar"
                onClick={() => setShopOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {shopStore && Number.isFinite(Number(shopStore.lat)) && Number.isFinite(Number(shopStore.lng)) ? (
              <div
                className={`flex-shrink-0 px-4 pb-3 ${wazeUi ? 'border-b border-[#1e2130]' : 'border-b border-white/10'}`}
              >
                <MapDirectionsRow
                  lat={shopStore.lat}
                  lng={shopStore.lng}
                  userOrigin={userMapPosition}
                  variant="dark"
                />
                <p
                  className={`mt-1.5 text-center text-[10px] leading-snug ${
                    wazeUi ? 'text-[#888]' : 'text-[#888]'
                  }`}
                >
                  Trajeto a partir da sua posição no Finmemory Maps (se usou Minha localização).
                </p>
              </div>
            ) : null}

            <div className={`min-h-0 flex-1 overflow-y-auto px-3 pb-8 ${wazeUi ? 'finmemory-waze-scroll' : ''}`}>
              {(shopOffers.length > 0 || shopPromotions.length > 0) && shopShelfCategories.length > 1 ? (
                <div
                  className={`sticky top-0 z-[6] -mx-3 mb-1 border-b px-3 py-2 ${
                    wazeUi
                      ? 'border-[#1e2130] bg-[#13161f]/72 shadow-[0_6px_16px_rgba(0,0,0,0.18)] supports-[backdrop-filter]:bg-[#13161f]/48 backdrop-blur-xl backdrop-saturate-150'
                      : 'border-white/10 bg-[#0f1117]/90 shadow-[0_6px_16px_rgba(0,0,0,0.35)] supports-[backdrop-filter]:bg-[#0f1117]/60 backdrop-blur-xl backdrop-saturate-150'
                  }`}
                >
                  <div className="finmemory-waze-scroll flex flex-shrink-0 gap-1.5 overflow-x-auto px-0.5">
                    {shopShelfCategories.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setShopFilterCat(c)}
                        className={`shrink-0 flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                          shopFilterCat === c
                            ? wazeUi
                              ? 'border-[#2ecc71] bg-[#2ecc71] text-[#0f1117]'
                              : 'border-[#2ECC49] bg-[#2ECC49] text-white'
                            : wazeUi
                              ? 'border-[#2a2d3a] bg-[#1a1d27] text-[#888] hover:border-[#2ecc71] hover:text-[#2ecc71]'
                              : 'border-white/15 bg-[#1a1d24] text-[#ccc] hover:border-[#2ECC49]/50 hover:text-[#2ECC49]'
                        }`}
                      >
                        {c === 'Todos' ? 'Todos' : `${ENCARTE_CATEGORY_ICONS[c] ? `${ENCARTE_CATEGORY_ICONS[c]} ` : ''}${c}`}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div
                className={`mb-2 mt-2 flex items-center justify-between rounded-lg px-2.5 py-2 text-[11px] ${
                  wazeUi
                    ? 'border border-[#2a2d3a] bg-[#1a1d27] text-[#bbb]'
                    : 'border border-amber-200 bg-amber-50 text-amber-900'
                }`}
              >
                <span>Precos podem variar na loja fisica. Compare antes de fechar compra.</span>
              </div>
              {shopLoading && (
                <div className="flex justify-center py-12">
                  <Loader2
                    className={`h-8 w-8 animate-spin ${wazeUi ? 'text-[#2ecc71]' : 'text-[#2ECC49]'}`}
                  />
                </div>
              )}
              {shopErr ? (
                <p className={`py-4 text-sm ${wazeUi ? 'text-red-400' : 'text-red-600'}`}>{shopErr}</p>
              ) : null}
              {!shopLoading && !shopErr && shopOffers.length === 0 && shopPromotions.length === 0 ? (
                <p className={`py-6 text-center text-sm ${wazeUi ? 'text-[#888]' : 'text-[#a1a1aa]'}`}>
                  Nenhuma promoção encontrada para esta loja nesta região.
                </p>
              ) : null}
              {!shopLoading && shopPromotions.length > 0 ? (
                <>
                  <p
                    className={`mb-2 px-0.5 text-xs font-semibold ${wazeUi ? 'text-[#888]' : 'text-gray-500'}`}
                  >
                    Promoções (encarte)
                  </p>
                  <div
                    className={`mb-2 flex flex-wrap gap-1.5 px-0.5 ${wazeUi ? 'text-[#888]' : 'text-gray-600'}`}
                  >
                    {[
                      { id: 'validade', label: 'Por validade' },
                      { id: 'preco', label: 'Por preço' },
                      { id: 'nome', label: 'Por produto' },
                      { id: 'imagem', label: 'Com imagem' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setEncarteSortBy(opt.id)}
                        className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
                          encarteSortBy === opt.id
                            ? wazeUi
                              ? 'border-[#2ecc71] bg-[#2ecc71] text-[#0f1117]'
                              : 'border-[#2ECC49] bg-emerald-50 text-emerald-900'
                            : wazeUi
                              ? 'border-[#2a2d3a] bg-[#1a1d27] text-[#888] hover:border-[#2ecc71]'
                              : 'border-white/15 bg-[#1a1d24] text-[#bbb] hover:border-[#2ECC49]/45'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className={`grid grid-cols-2 gap-2 pb-3 ${wazeUi ? 'gap-2.5 sm:grid-cols-3' : ''}`}>
                    {filteredShopPromotions.map((row) => (
                      <div
                        key={row.id}
                        onMouseEnter={onDesktopPromoHoverEnter}
                        onMouseLeave={onDesktopPromoHoverLeave}
                      >
                        <PromotionEncarteCard
                          row={row}
                          wazeUi={wazeUi}
                          accentHex={shopAccent}
                          selected={selectedItems.includes(String(row.id))}
                          onToggle={() => toggleSelectedPromotionItem(row)}
                        />
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
              {!shopLoading && filteredShopOffers.length > 0 ? (
                <>
                  <div
                    className={`mb-2 overflow-hidden rounded-xl ${wazeUi ? 'border border-[#2a2d3a]' : 'border border-white/10'}`}
                    onMouseEnter={onDesktopPromoHoverEnter}
                    onMouseLeave={onDesktopPromoHoverLeave}
                  >
                    <StoreBelongingBanner store={shopStore} />
                    <HeroOfferCarousel
                      sources={uniqueDisplayableImageUrls(
                        filteredShopOffers.map((o) => ({
                          promo_image_url: o.promo_image_url,
                          categoria: o.category,
                          id: o.id,
                          produto: o.product_name,
                        }))
                      )}
                      storeTitle={shopStore?.name || ''}
                      count={filteredShopOffers.length}
                      category={filteredShopOffers[0]?.category || ''}
                      dense
                    />
                  </div>
                  {wazeUi ? (
                    <div className="grid grid-cols-2 gap-2.5 pb-4 sm:grid-cols-3">
                      {filteredShopOffers.map((offer) => (
                        <div
                          key={offer.id}
                          onMouseEnter={onDesktopPromoHoverEnter}
                          onMouseLeave={onDesktopPromoHoverLeave}
                        >
                          <WazeOfferCard
                            offer={offer}
                            selected={cartOfferIdSet.has(String(offer.id))}
                            onToggle={() => toggleCartOffer(offer)}
                            accentHex="#2ecc71"
                            canConfirmPrice={Boolean(session?.user?.email)}
                            confirmBusy={confirmOfferBusyId === String(offer.id)}
                            onConfirmOffer={() => handleOfferConfirmed(offer)}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-1.5 pb-4">
                      {filteredShopOffers.map((offer, i) => {
                        const pt = {
                          id: offer.id,
                          nome: shopStore?.name || offer.store_name || '',
                          produto: offer.product_name,
                          categoria: offer.category || '',
                          promo_image_url: offer.promo_image_url,
                          observed_at: offer.observed_at,
                        };
                        const label = formatPrecoExibicao(offer.price, offer.category, offer.id);
                        const priceSlot =
                          label != null ? (
                            label
                          ) : offer.promo_image_url ? (
                            <a
                              href={offer.promo_image_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] font-semibold text-emerald-700 underline"
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => e.stopPropagation()}
                            >
                              Ver encarte
                            </a>
                          ) : (
                            <span className="text-[11px] text-gray-500">Preço no encarte</span>
                          );
                        return (
                          <div
                            key={offer.id || i}
                            onMouseEnter={onDesktopPromoHoverEnter}
                            onMouseLeave={onDesktopPromoHoverLeave}
                          >
                            <ProductOfferThumb
                              point={pt}
                              accentHex={shopAccent}
                              priceSlot={priceSlot}
                              compact
                              selected={cartOfferIdSet.has(String(offer.id))}
                              interactive
                              onActivate={() => toggleCartOffer(offer)}
                              canConfirmPrice={Boolean(session?.user?.email)}
                              confirmBusy={confirmOfferBusyId === String(offer.id)}
                              onConfirmOffer={() => handleOfferConfirmed(offer)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : null}
            </div>
        </aside>
      ) : null}

      {shopOpen && isMobileMapSheet ? (
        <EstablishmentDetailSheet
          open={shopOpen}
          store={shopStore}
          offers={shopOffers}
          promotions={shopPromotions}
          loading={shopLoading}
          error={shopErr}
          onClose={() => setShopOpen(false)}
          onVisualMetrics={handleShopSheetVisualMetrics}
          canConfirmPrice={Boolean(session?.user?.email)}
          appUserId={session?.user?.supabaseId}
          onToggleCart={toggleCartFromDetailSheet}
          isCartSelected={isDetailSheetProductInCart}
          onOfferSeenUpdated={(offerId, observedAt) => {
            setShopOffers((prev) =>
              prev.map((o) =>
                String(o.id) === String(offerId) ? { ...o, observed_at: observedAt, time_ago: 'Agora' } : o
              )
            );
          }}
        />
      ) : null}
    </div>
  );
}
