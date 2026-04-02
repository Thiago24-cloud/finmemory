'use client';

import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import { promoShelfLabel, stripFanoutProductSuffix } from '../lib/mapOfferDisplay';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ShoppingCart, Loader2, Check, X } from 'lucide-react';
import { getMapThemeById, getCategoryColor, getStorePinMainColor } from '../lib/colors';
import { SAO_PAULO_STATE_CENTER, SAO_PAULO_STATE_ZOOM } from '../lib/saoPauloStateMap';
import { getSupabase } from '../lib/supabase';

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

const DEFAULT_ICON = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

/** Pin de preço no mapa. Vários itens no mesmo lugar → bolha maior com o total (ex.: 29), para não “sumir” atrás do pin da loja. */
function createCategoryIcon(hexColor, bundleCount = 1) {
  const n = Math.max(1, Number(bundleCount) || 1);
  const isBundle = n > 1;
  const size = isBundle ? 42 : 32;
  const half = size / 2;
  const label = isBundle
    ? `<span style="font-size:14px;font-weight:800;color:#fff;line-height:1;text-shadow:0 1px 2px rgba(0,0,0,.45);">${n}</span>`
    : '';
  return L.divIcon({
    className: 'custom-pin custom-pin-price',
    html: `<div style="background:${hexColor};width:${size}px;height:${size}px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;">${label}</div>`,
    iconSize: [size, size],
    iconAnchor: [half, half],
    popupAnchor: [0, -half]
  });
}

/** Mapeia tipo da loja (API) para categoria do formulário de partilha */
function storeTypeToCategory(type) {
  if (!type) return 'Supermercado';
  const t = String(type).toLowerCase();
  if (t === 'pharmacy') return 'Farmácia';
  if (t === 'bakery') return 'Padaria';
  return 'Supermercado';
}

/** Texto ao lado do pin (estilo Google Maps): curto para não poluir. */
function truncateMapLabel(text, max = 36) {
  const s = String(text || '').trim();
  if (!s) return '';
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1))}…`;
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

/**
 * Pin de loja: gota + lente branca + ícone em traço; oferta = ponto âmbar (cor do tipo mantida).
 */
function createStoreIcon(type, temOfertaHoje = false, storeKey = '') {
  const pinColor = getStorePinMainColor(type, storeKey);
  const glyph = storePinGlyphPaths(type);
  const promo = temOfertaHoje
    ? '<circle cx="23.5" cy="4" r="3" fill="#FBBF24" stroke="#fff" stroke-width="1.15"/>'
    : '';
  const html = `<div class="finmemory-store-pin-wrap" style="line-height:0;">
<svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<path fill="${pinColor}" stroke="rgba(255,255,255,0.88)" stroke-width="1"
  style="filter:drop-shadow(0 1.5px 2.5px rgba(0,0,0,.2))"
  d="M14 1.2C6.9 1.2 1 7.1 1 14.1c0 7.4 10.8 18.6 13 20.9 2.2-2.3 13-13.5 13-20.9C27 7.1 21.1 1.2 14 1.2z"/>
<circle cx="14" cy="12.2" r="5.35" fill="#fff"/>
<g transform="translate(14 12.2)" fill="none" stroke="${pinColor}" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round">
${glyph}
</g>
${promo}
</svg></div>`;
  return L.divIcon({
    className: 'custom-pin finmemory-store-pin',
    html,
    iconSize: [28, 36],
    iconAnchor: [14, 34],
    popupAnchor: [0, -30]
  });
}

/**
 * Carrega estabelecimentos do banco (stores) na área visível do mapa e exibe com ícone por tipo.
 * Não altera os pins de preços compartilhados (price_points).
 */
function StoreMarkers({ storeFilterName = '', searchQuery = '', onRequestStoreShop }) {
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

  /** Pesquisa aplica-se ao nome da loja (ex.: "Dia"); se nenhuma loja bater, mostra todas (ex.: "arroz" é produto). */
  const effectiveQuery = String(storeFilterName || searchQuery || '')
    .trim()
    .toLowerCase();

  const visibleStores = useMemo(() => {
    if (effectiveQuery.length < 2) return stores;
    const matched = stores.filter((s) => String(s.name || '').toLowerCase().includes(effectiveQuery));
    return matched.length > 0 ? matched : stores;
  }, [stores, effectiveQuery]);

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
        <StoreMarkerItem key={store.id} store={store} showPinLabels={showPinLabels} />
      ))}
    </>
  );
}

/**
 * Ícone Leaflet estável: recriar divIcon a cada render faz setIcon() e o popup fecha sozinho.
 */
function StoreMarkerItem({ store, showPinLabels, onRequestStoreShop }) {
  const icon = useMemo(
    () => createStoreIcon(store.type, !!store.tem_oferta_hoje, store.id),
    [store.type, store.tem_oferta_hoje, store.id]
  );

  return (
    /** Acima dos círculos de preço/promo (2500); senão milhares de ofertas DIA tapam os pins de loja. */
    <Marker position={[Number(store.lat), Number(store.lng)]} icon={icon} zIndexOffset={3500}>
      {showPinLabels && (
        <Tooltip
          permanent
          direction="right"
          offset={[12, 0]}
          opacity={1}
          interactive={false}
          className="finmemory-map-label finmemory-map-label--store"
        >
          {truncateMapLabel(store.name, 40)}
        </Tooltip>
      )}
      <Popup>
        <div
          className="p-2 min-w-[180px]"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <span
            className="inline-block px-2 py-0.5 rounded text-xs font-semibold text-white mb-1"
            style={{
              backgroundColor: getStorePinMainColor(store.type, store.id),
              boxShadow: store.tem_oferta_hoje ? 'inset 0 0 0 2px #FBBF24' : undefined
            }}
          >
            {storeTypeLabel(store.type)}
          </span>
          <h3 className="font-bold text-gray-900 text-sm mt-1">{store.name}</h3>
          {store.address && <p className="text-xs text-gray-600 mt-0.5">{store.address}</p>}
          {store.neighborhood && <p className="text-xs text-gray-500">{store.neighborhood}</p>}
          {store.tem_oferta_hoje && (
            <div className="mt-2">
              <p className="text-xs font-semibold text-amber-700">
                Ofertas ativas: {store.offer_count || 0}
              </p>
              {Array.isArray(store.offer_products) && store.offer_products.length > 0 && (
                <ul
                  className="mt-1 max-h-[220px] overflow-y-auto space-y-1 text-xs text-gray-700 pl-4 list-disc pr-1"
                  style={{ touchAction: 'pan-y', scrollbarGutter: 'stable' }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onWheel={(e) => e.stopPropagation()}
                >
                  {store.offer_products.map((prod, i) => (
                    <li key={`${store.id}-offer-${i}`}>{prod}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {typeof onRequestStoreShop === 'function' && (
            <button
              type="button"
              className="mt-3 w-full py-2 px-3 rounded-lg bg-[#2ECC49] text-white text-xs font-semibold hover:bg-[#22a83a] shadow-sm"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onRequestStoreShop(store);
              }}
            >
              Ver promoções / Montar cesta
            </button>
          )}
        </div>
      </Popup>
    </Marker>
  );
}

/**
 * Localização no mapa: só pede ao utilizador depois de um toque no botão.
 * Em muitos telemóveis o browser bloqueia GPS se for pedido ao abrir a página.
 * onLocationFound(lat, lng) é chamado quando a localização é obtida (para geo-fencing).
 */
function LocationMarker({ onLocationFound, headerOffsetPx = 56 }) {
  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const [locating, setLocating] = useState(false);
  const { map, zoom } = useMapAndZoom();
  const showYouLabel = zoom >= MAP_LABEL_MIN_ZOOM;
  const onLocationFoundRef = useRef(onLocationFound);
  onLocationFoundRef.current = onLocationFound;

  const requestLocation = useCallback(() => {
    if (!map) return;
    setError(null);
    setLocating(true);
    // setView: false — um único flyTo no handler evita animação dupla e “pulos” do mapa
    map.locate({ setView: false, watch: false, maxZoom: 16, timeout: 15000, enableHighAccuracy: true });
  }, [map]);

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
    </>
  );
}

/** Busca todos os pontos recentes do mapa (sem ?q). O filtro por busca é feito no cliente — assim as ofertas da loja e os pins não “dessincronizam”. */
/**
 * Preço no mapa: encartes Dia não têm preço no JSON do site — nunca mostrar centavo fictício.
 * Linhas promo-* ou categoria com "promo": tratar ≤ R$ 0,01 como sem valor numérico.
 */
function formatPrecoExibicao(preco, categoria, id) {
  if (preco == null || preco === '') return null;
  const n = Number(preco);
  if (!Number.isFinite(n)) return null;
  const promoLike =
    String(id || '').startsWith('promo-') ||
    String(categoria || '').toLowerCase().includes('promo');
  if (promoLike && n <= 0.01) return null;
  return `R$ ${n.toFixed(2)}`;
}

/** Soma no carrinho / orçamento: ignora promo sem preço real. */
function numericPriceForSum(preco, categoria, id) {
  if (preco == null || preco === '') return null;
  const n = Number(preco);
  if (!Number.isFinite(n) || n <= 0) return null;
  const promoLike =
    String(id || '').startsWith('promo-') ||
    String(categoria || '').toLowerCase().includes('promo');
  if (promoLike && n <= 0.01) return null;
  return n;
}

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
    const res = await fetch(qs ? `/api/map/points?${qs}` : '/api/map/points');
    if (!res.ok) return [];
    const json = await res.json();
    const points = json.points || [];
    return points.map((p) => ({
      id: p.id,
      nome: p.store_name,
      produto: p.product_name,
      preco: p.price,
      precoLabel: formatPrecoExibicao(p.price, p.category, p.id),
      promo_image_url: p.promo_image_url || null,
      lat: Number(p.lat),
      lng: Number(p.lng),
      categoria: p.category || '',
      time_ago: p.time_ago,
      user_label: p.user_label
    }));
  } catch (e) {
    console.warn('Erro ao buscar pontos do mapa:', e);
    return [];
  }
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

/** Carrega pontos: busca por produto (global) ou por área visível (região / pan). */
function PricePointsLoader({ searchIntent, setLocais, setCarregando, reloadRef }) {
  const map = useMap();
  const debounceRef = useRef(null);
  const productMode = searchIntent.type === 'product';

  const load = useCallback(async () => {
    if (!map) return;
    if (searchIntent.type === 'region') return;
    setCarregando(true);
    try {
      const points = await fetchMapPoints(map, searchIntent);
      setLocais(points.filter((p) => !Number.isNaN(p.lat) && !Number.isNaN(p.lng)));
    } catch (error) {
      console.error('Erro ao buscar locais:', error);
    }
    setCarregando(false);
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

/** Agrupa pontos pelo mesmo local (lat/lng arredondados) para evitar marcadores empilhados. */
function groupPointsByLocation(points) {
  const groups = new Map();
  const round = (n) => Number(n).toFixed(5);
  points.forEach((p) => {
    const key = `${round(p.lat)}_${round(p.lng)}`;
    if (!groups.has(key)) {
      groups.set(key, { lat: p.lat, lng: p.lng, points: [], nome: p.nome });
    }
    groups.get(key).points.push(p);
  });
  return Array.from(groups.values());
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

function isDisplayableImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  if (isEncarteOrNonImageUrl(url)) return false;
  const u = url.trim().toLowerCase();
  if (/\.(webp|jpg|jpeg|png|gif|avif|svg)(\?|#|$|&)/i.test(u)) return true;
  if (
    /imgur|cloudinary|imgix|supabase.*\/storage|googleusercontent|twimg|gpa\.digital|paodeacucar|dia\.com\.br|cdn|akamai|cloudfront|openfoodfacts\.org/i.test(
      u
    )
  ) {
    return true;
  }
  return /^https?:\/\//i.test(u) && !/\.(pdf|zip)(\?|$)/i.test(u);
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
  return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function promotionEncarteDiscountPct(original, promo) {
  const o = Number(original);
  const p = Number(promo);
  if (!Number.isFinite(o) || !Number.isFinite(p) || o <= p || o <= 0) return null;
  return Math.round((1 - p / o) * 100);
}

/** Linhas de `public.promotions` (store_id + active) no painel ao abrir pin da loja. */
function PromotionEncarteCard({ row, wazeUi, accentHex, selected, onToggle }) {
  const glyph = categoryFallbackGlyph(row.category);
  const pct = promotionEncarteDiscountPct(row.original_price, row.promo_price);
  const orig = row.original_price != null ? Number(row.original_price) : null;
  const promo = Number(row.promo_price);
  const showOrig = Number.isFinite(orig) && orig > promo;

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
        className={`flex aspect-[4/3] min-h-[72px] items-center justify-center text-4xl ${
          wazeUi ? 'bg-[#161922]' : 'bg-gradient-to-br from-gray-100 to-gray-200'
        }`}
      >
        <span aria-hidden>{glyph}</span>
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
        <p className="mt-auto pt-1 text-[13px] font-bold tabular-nums" style={{ color: accentHex }}>
          R$ {formatBRLPriceNum(promo)}
        </p>
      </div>
    </div>
  );
}

/** Card de oferta no painel escuro “Waze dos Preços” (dados reais da API). */
function WazeOfferCard({ offer, selected, onToggle, accentHex }) {
  const [imgBroken, setImgBroken] = useState(false);
  const shelf =
    promoShelfLabel(offer.category) || offerShelfCategory(offer);
  const glyph = categoryFallbackGlyph(offer.category);
  const displayName = stripFanoutProductSuffix(offer.product_name);
  const priceNum = numericPriceForSum(offer.price, offer.category, offer.id);
  const url = offer.promo_image_url;
  const showImg = url && isDisplayableImageUrl(url) && !isEncarteOrNonImageUrl(url) && !imgBroken;

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
            src={url}
            alt=""
            className="finmemory-offer-photo max-h-20 w-full object-cover"
            loading="lazy"
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
      <p className="mb-1.5 text-left text-[11px] text-[#888]">{shelf}</p>
      {priceNum != null && priceNum > 0 ? (
        <p className="text-base font-bold tabular-nums" style={{ color: accentHex }}>
          R$ {formatBRLPriceNum(priceNum)}
        </p>
      ) : (
        <p className="text-left text-xs text-[#888]">Preço no encarte / loja</p>
      )}
    </div>
  );
}

/** Hero com carrossel quando há várias fotos; autoplay leve + pontos e setas. */
function HeroOfferCarousel({ sources, storeTitle, count }) {
  const [idx, setIdx] = useState(0);
  const [brokenByUrl, setBrokenByUrl] = useState(() => ({}));

  const n = sources.length;
  const safeIdx = n ? idx % n : 0;
  const currentUrl = n ? sources[safeIdx] : '';

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

  return (
    <div className="relative h-[152px] w-full overflow-hidden bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200">
      {n === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-300/90 to-slate-400/80">
          <span className="text-5xl drop-shadow-sm" aria-hidden>
            🛒
          </span>
        </div>
      )}

      {n > 0 && showSlide && (
        <img
          src={currentUrl}
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
            🛒
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
            className="absolute bottom-[52px] left-0 right-0 z-[2] flex justify-center gap-1.5 px-8"
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

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] bg-gradient-to-t from-black/70 via-black/30 to-transparent pt-20 pb-3 px-3">
        <p className="text-[15px] font-bold text-white leading-tight drop-shadow-md line-clamp-2">{storeTitle}</p>
        <p className="text-[11px] font-medium text-white/90 mt-0.5">
          {count} {count === 1 ? 'oferta' : 'ofertas'} em destaque
          {n > 1 ? ` · ${safeIdx + 1}/${n} fotos` : ''}
        </p>
      </div>
    </div>
  );
}

/** Miniatura do produto — imagem real ou placeholder (estilo vitrine). */
function ProductOfferThumb({ point, accentHex, priceSlot, selected, interactive, onActivate }) {
  const [broken, setBroken] = useState(false);
  const url = point.promo_image_url;
  const encarteOnly = url && isEncarteOrNonImageUrl(url);
  const tryImage = url && isDisplayableImageUrl(url) && !encarteOnly;
  const fallbackGlyph = categoryFallbackGlyph(point.categoria);
  const displayName = stripFanoutProductSuffix(point.produto);
  const shelf = promoShelfLabel(point.categoria);

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

  return (
    <Wrapper
      {...wrapProps}
      className={`rounded-xl border border-gray-100/90 bg-white shadow-sm overflow-hidden flex flex-col text-left w-full relative transition-[box-shadow] ${
        interactive ? 'cursor-pointer hover:opacity-95' : ''
      } ${
        selected
          ? 'ring-[3px] ring-[#2ECC49] ring-offset-2 ring-offset-white shadow-md'
          : ''
      }`}
    >
      {selected && (
        <span
          className="absolute top-1.5 right-1.5 z-[2] flex h-6 w-6 items-center justify-center rounded-full bg-[#2ECC49] text-white shadow-md"
          aria-hidden
        >
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
      )}
      <div
        className="relative aspect-[4/3] w-full bg-gradient-to-br from-gray-100 to-gray-200"
        style={{ minHeight: '88px' }}
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
            src={url}
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
            <span className="text-3xl opacity-95 drop-shadow-sm">{fallbackGlyph}</span>
          </div>
        )}
      </div>
      <div className="p-2 flex flex-col flex-1 min-h-0">
        <p className="text-[11px] font-semibold text-gray-900 leading-snug line-clamp-3 min-h-[2.75rem]" title={point.produto}>
          {displayName}
        </p>
        {shelf ? (
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 truncate">
            {shelf}
          </p>
        ) : null}
        <div className="mt-auto pt-1.5 text-[12px] font-bold leading-tight" style={{ color: accentHex }}>
          {priceSlot}
        </div>
        {interactive && onActivate ? (
          <button
            type="button"
            className={`mt-2 w-full rounded-lg py-1.5 text-[11px] font-bold transition-colors ${
              selected
                ? 'bg-[#2ECC49] text-white hover:bg-[#22a83a]'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              onActivate();
            }}
          >
            {selected ? '✓ Na cesta — toque para remover' : '+ Cesta'}
          </button>
        ) : null}
      </div>
    </Wrapper>
  );
}

/**
 * Card estilo “detalhe do lugar” do Google Maps: hero com imagem, título, grelha de ofertas com fotos.
 */
function MapsStyleOfferPopup({ group, accentHex, cartOfferIdSet, onMapPointCartToggle }) {
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

  return (
    <div
      className="finmemory-popup-maps-card text-left select-none"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <HeroOfferCarousel sources={heroSources} storeTitle={storeTitle} count={count} />

      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <span
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white shadow-sm"
            style={{ backgroundColor: accentHex }}
          >
            {count === 1
              ? promoShelfLabel(first?.categoria) ||
                (String(first?.categoria || '').toLowerCase().includes('promo') ? 'Promoção' : '') ||
                first?.categoria ||
                'Oferta'
              : `${count} itens`}
          </span>
          {showTotal && (
            <span className="text-[12px] font-semibold text-gray-600 tabular-nums">Total R$ {total.toFixed(2)}</span>
          )}
        </div>

        <div
          className="grid grid-cols-2 gap-2 max-h-[min(320px,45vh)] overflow-y-auto pr-0.5 -mr-0.5"
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
                interactive={Boolean(onMapPointCartToggle)}
                selected={cartOfferIdSet?.has(String(p.id))}
                onActivate={() => onMapPointCartToggle?.(p)}
              />
            );
          })}
        </div>

        {onMapPointCartToggle ? (
          <p className="text-[10px] text-emerald-700 font-medium mt-2 px-0.5 leading-snug">
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
function PriceMarkersLayer({ groups, searchQuery, cartOfferIdSet, onMapPointCartToggle }) {
  return (
    <>
      {groups.map((group) => (
        <PriceGroupMarker
          key={`pg-${Number(group.lat).toFixed(5)}_${Number(group.lng).toFixed(5)}`}
          group={group}
          searchQuery={searchQuery}
          cartOfferIdSet={cartOfferIdSet}
          onMapPointCartToggle={onMapPointCartToggle}
        />
      ))}
    </>
  );
}

/** Ícone memoizado + key estável — evita setIcon() e fechamento do popup ao atualizar pontos. */
function PriceGroupMarker({ group, searchQuery, cartOfferIdSet, onMapPointCartToggle }) {
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

  const customIcon = useMemo(
    () => createCategoryIcon(main, count),
    [main, count]
  );

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
          {priceGroupMapLabel(group)}
        </Tooltip>
      )}
      <Popup className="mapa-precos-popup-agrupado finmemory-popup-price-offers">
        <MapsStyleOfferPopup
          group={group}
          accentHex={main}
          cartOfferIdSet={cartOfferIdSet}
          onMapPointCartToggle={onMapPointCartToggle}
        />
      </Popup>
    </Marker>
  );
}

export default function MapaPrecosLeaflet({
  mapThemeId = 'padrao',
  searchQuery = '',
  promoOnly = false,
  wazeUi = false,
  headerOffsetPx = 56,
}) {
  const theme = getMapThemeById(mapThemeId);
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const [locais, setLocais] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const reloadPointsRef = useRef(() => {});
  const [storeNearby, setStoreNearby] = useState(null);
  const [dismissedStorePrompt, setDismissedStorePrompt] = useState(false);

  const [shopOpen, setShopOpen] = useState(false);
  const [shopStore, setShopStore] = useState(null);
  const [shopOffers, setShopOffers] = useState([]);
  const [shopPromotions, setShopPromotions] = useState([]);
  /** IDs dos cards da tabela `promotions` selecionados no painel da loja (toggle por toque). */
  const [selectedItems, setSelectedItems] = useState([]);
  const [shopLoading, setShopLoading] = useState(false);
  const [shopErr, setShopErr] = useState('');
  const [promoCart, setPromoCart] = useState([]);
  const [budgetCap, setBudgetCap] = useState(50);
  const [savingList, setSavingList] = useState(false);
  const [saveBanner, setSaveBanner] = useState('');
  const [shopFilterCat, setShopFilterCat] = useState('Todos');

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
    () => ({ height: '100%', width: '100%', paddingTop: `${headerOffsetPx}px` }),
    [headerOffsetPx]
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
    if (!applyProductTextFilter || q.length < 2) return base;
    return base.filter(
      (p) =>
        (p.produto || '').toLowerCase().includes(q) ||
        (p.nome || '').toLowerCase().includes(q) ||
        (p.categoria || '').toLowerCase().includes(q)
    );
  }, [locais, searchQuery, promoOnly, applyProductTextFilter]);

  const priceGroups = useMemo(() => groupPointsByLocation(visibleLocais), [visibleLocais]);

  const handleLocationFound = useCallback((lat, lng) => {
    setDismissedStorePrompt(false);
    fetch(`/api/map/stores?lat=${lat}&lng=${lng}&radius=150`)
      .then((res) => (res.ok ? res.json() : { stores: [] }))
      .then((data) => {
        if (Array.isArray(data.stores) && data.stores.length > 0) {
          setStoreNearby(data.stores[0]);
        } else {
          setStoreNearby(null);
        }
      })
      .catch(() => setStoreNearby(null));
  }, []);

  const handleRequestStoreShop = useCallback((store) => {
    setShopStore(store);
    setShopOpen(true);
    setShopFilterCat('Todos');
    setShopLoading(true);
    setShopErr('');
    setShopOffers([]);
    setShopPromotions([]);
    setSelectedItems([]);
    fetch(`/api/map/store-offers?store_id=${encodeURIComponent(store.id)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Erro ao carregar ofertas');
        setShopOffers(Array.isArray(data.offers) ? data.offers : []);
        setShopPromotions(Array.isArray(data.promotions) ? data.promotions : []);
      })
      .catch((e) => setShopErr(e.message || 'Erro ao carregar ofertas'))
      .finally(() => setShopLoading(false));
  }, []);

  const toggleSelectedPromotionItem = useCallback((id) => {
    const sid = String(id);
    setSelectedItems((prev) =>
      prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid]
    );
  }, []);

  const shopAccent = useMemo(() => {
    if (!shopStore) return '#2ECC49';
    const { main } = getCategoryColor('Supermercado - Promoção', shopStore.name);
    return main;
  }, [shopStore]);

  const toggleCartOffer = useCallback(
    (offer, storeLabelOverride) => {
      const id = String(offer.id);
      const storeLabel = storeLabelOverride || shopStore?.name || 'Loja';
      setPromoCart((prev) => {
        const ix = prev.findIndex((x) => x.offerId === id);
        if (ix >= 0) return prev.filter((_, i) => i !== ix);
        const priceNum = numericPriceForSum(offer.price, offer.category, offer.id);
        return prev.concat({
          offerId: id,
          productName: offer.product_name,
          storeLabel,
          priceNum,
          precoLabel: formatPrecoExibicao(offer.price, offer.category, offer.id),
        });
      });
    },
    [shopStore]
  );

  const toggleCartFromMapPoint = useCallback(
    (p) => {
      toggleCartOffer(
        {
          id: p.id,
          product_name: p.produto,
          category: p.categoria,
          price: p.preco,
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

  const cartOfferIdSet = useMemo(() => new Set(promoCart.map((x) => x.offerId)), [promoCart]);

  const selectedPromotionRowsOrdered = useMemo(() => {
    const byId = new Map(shopPromotions.map((r) => [String(r.id), r]));
    return selectedItems.map((id) => byId.get(id)).filter(Boolean);
  }, [selectedItems, shopPromotions]);

  const selectedEncarteTotal = useMemo(
    () =>
      selectedPromotionRowsOrdered.reduce((s, r) => {
        const n = Number(r.promo_price);
        return s + (Number.isFinite(n) ? n : 0);
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

  const shopOfferShelfCats = useMemo(() => {
    if (!shopOffers.length) return ['Todos'];
    const set = new Set(shopOffers.map((o) => offerShelfCategory(o)));
    return ['Todos', ...[...set].sort((a, b) => a.localeCompare(b, 'pt'))];
  }, [shopOffers]);

  const filteredShopOffers = useMemo(() => {
    if (!wazeUi || shopFilterCat === 'Todos') return shopOffers;
    return shopOffers.filter((o) => offerShelfCategory(o) === shopFilterCat);
  }, [shopOffers, shopFilterCat, wazeUi]);

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
      const { data: memberRow, error: e1 } = await supabase
        .from('partnership_members')
        .select('partnership_id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();
      if (e1 || !memberRow) {
        setSaveBanner('Você precisa de uma parceria ativa.');
        return;
      }
      const { data: p, error: e2 } = await supabase
        .from('partnerships')
        .select('id')
        .eq('id', memberRow.partnership_id)
        .eq('status', 'active')
        .maybeSingle();
      if (e2 || !p) {
        setSaveBanner('Parceria não encontrada.');
        return;
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
      const { error: insErr } = await supabase.from('shopping_lists').insert({
        partnership_id: p.id,
        created_by: userId,
        total,
        items: itemsPayload,
      });
      if (insErr) throw insErr;
      setPromoCart([]);
      router.push('/listas');
    } catch (e) {
      setSaveBanner(e.message || 'Não foi possível salvar.');
    } finally {
      setSavingList(false);
    }
  }, [session, promoCart, router]);

  /** Atualização periódica só com aba visível (mapa mais “vivo” sem custo em background). */
  useEffect(() => {
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        reloadPointsRef.current?.();
      }
    }, 50000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={DEFAULT_MAP_CENTER}
        zoom={DEFAULT_MAP_ZOOM}
        style={mapContainerStyle}
        className={`z-0 finmemory-map-tiles finmemory-map-theme-${theme.id}`}
      >
        <TileLayer
          attribution={
            theme.attribution ||
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; CARTO'
          }
          url={theme.url}
          detectRetina={theme.id === 'verde' || theme.id === 'waze'}
        />
        <LocationMarker onLocationFound={handleLocationFound} headerOffsetPx={headerOffsetPx} />
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
          groups={priceGroups}
          searchQuery={searchQuery}
          cartOfferIdSet={cartOfferIdSet}
          onMapPointCartToggle={toggleCartFromMapPoint}
        />
        <StoreMarkers searchQuery={searchQuery} onRequestStoreShop={handleRequestStoreShop} />
      </MapContainer>

      {/* Geo-fencing: "Você está perto de [loja]. Gostaria de compartilhar um preço?" */}
      {storeNearby && !dismissedStorePrompt && (
        <div className="absolute left-3 right-3 sm:left-4 sm:right-4 bottom-36 sm:bottom-44 z-[1001] max-w-[320px]">
          <div className="bg-white rounded-xl shadow-lg border border-emerald-200 p-4 flex flex-col gap-3">
            <p className="text-sm text-gray-800 font-medium">
              Você está perto de <span className="font-semibold text-emerald-700">{storeNearby.name}</span>.
              <br />
              Gostaria de compartilhar um preço?
            </p>
            <div className="flex gap-2">
              <a
                href={`/share-price?store=${encodeURIComponent(storeNearby.name)}&category=${encodeURIComponent(storeTypeToCategory(storeNearby.type))}`}
                className="flex-1 py-2 px-3 rounded-lg bg-emerald-500 text-white text-sm font-semibold text-center hover:bg-emerald-600 no-underline"
              >
                Sim, compartilhar
              </a>
              <button
                type="button"
                onClick={() => setDismissedStorePrompt(true)}
                className="py-2 px-3 rounded-lg bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200"
              >
                Agora não
              </button>
            </div>
          </div>
        </div>
      )}

      {promoCart.length > 0 && (
        <div
          style={{ top: headerOffsetPx }}
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
                  {line.priceNum != null ? `R$ ${line.priceNum.toFixed(2)}` : '—'}
                </span>
                <button
                  type="button"
                  className={`shrink-0 px-1 font-bold leading-none ${
                    wazeUi ? 'text-[#555] hover:text-red-400' : 'text-red-500 hover:text-red-700'
                  }`}
                  aria-label="Remover"
                  onClick={() =>
                    setPromoCart((prev) => prev.filter((x) => x.offerId !== line.offerId))
                  }
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
                R$ {cartTotalNumeric.toFixed(2)}
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
              href="/listas"
              className={`block text-center text-[10px] font-medium underline ${
                wazeUi ? 'text-[#2ecc71]' : 'text-emerald-600'
              }`}
            >
              Ver listas salvas
            </Link>
            <Link
              href="/shopping-list"
              className={`block text-center text-[10px] font-medium underline ${
                wazeUi ? 'text-[#888]' : 'text-gray-500'
              }`}
            >
              Lista de compras compartilhada
            </Link>
          </div>
        </div>
      )}

      {selectedItems.length > 0 && (
        <aside
          style={{
            top: headerOffsetPx,
            height: `calc(100dvh - ${headerOffsetPx}px)`,
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
            {selectedPromotionRowsOrdered.map((row) => (
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
                  R$ {formatBRLPriceNum(row.promo_price)}
                </span>
                <button
                  type="button"
                  className={`shrink-0 rounded p-0.5 leading-none ${
                    wazeUi ? 'text-[#888] hover:bg-[#2a2d3a] hover:text-red-400' : 'text-gray-500 hover:bg-gray-200 hover:text-red-600'
                  }`}
                  aria-label="Remover da seleção"
                  onClick={() => toggleSelectedPromotionItem(row.id)}
                >
                  <X className="h-4 w-4" strokeWidth={2.5} />
                </button>
              </div>
            ))}
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
                R$ {selectedEncarteTotal.toFixed(2)}
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

      {wazeUi && !shopOpen && (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-[999] max-w-[min(92vw,420px)] -translate-x-1/2 px-2">
          <div className="pointer-events-auto rounded-xl border border-[#2a2d3a] bg-[#13161f]/92 px-4 py-3 text-center text-[13px] text-[#888] shadow-lg backdrop-blur-md">
            Toque no pin da loja e use <span className="font-semibold text-[#2ecc71]">Ver promoções / Montar cesta</span>
          </div>
        </div>
      )}

      {shopOpen && (
        <>
          <button
            type="button"
            className={`fixed inset-0 z-[1003] cursor-default border-0 p-0 ${wazeUi ? 'bg-black/70' : 'bg-black/50'}`}
            aria-label="Fechar painel"
            onClick={() => setShopOpen(false)}
          />
          <div
            className={`fixed inset-x-0 bottom-0 z-[1004] flex flex-col shadow-[0_-8px_40px_rgba(0,0,0,0.35)] ${
              wazeUi
                ? `max-h-[min(62vh,720px)] rounded-t-2xl border-t border-[#2a2d3a] bg-[#13161f] sm:max-h-[min(88vh,760px)] ${
                    promoCart.length > 0 || selectedItems.length > 0
                      ? 'sm:mr-[min(300px,calc(100vw-0.5rem))]'
                      : ''
                  }`
                : `max-h-[min(88vh,640px)] rounded-t-3xl border-t border-gray-200 bg-white shadow-[0_-8px_32px_rgba(0,0,0,0.12)] ${
                    promoCart.length > 0 || selectedItems.length > 0
                      ? 'sm:mr-[min(300px,calc(100vw-0.5rem))]'
                      : ''
                  }`
            }`}
          >
            <div
              className={`flex flex-shrink-0 items-center justify-between px-4 pb-2 pt-3 ${
                wazeUi ? 'border-b border-[#1e2130]' : 'border-b border-gray-100'
              }`}
            >
              <div className="min-w-0 pr-2">
                <p className={`text-xs font-semibold ${wazeUi ? 'text-[#888]' : 'text-gray-500'}`}>
                  {wazeUi ? 'Waze dos Preços · compra em tempo real' : 'Compra em tempo real'}
                </p>
                <h2 className={`truncate text-lg font-bold ${wazeUi ? 'text-[#f0f0f0]' : 'text-gray-900'}`}>
                  {shopStore?.name}
                </h2>
                {wazeUi && shopStore?.address ? (
                  <p className="mt-0.5 truncate text-[11px] text-[#888]">{shopStore.address}</p>
                ) : null}
                {latestOfferObservedLabel ? (
                  <p className={`mt-0.5 text-[11px] ${wazeUi ? 'text-amber-300' : 'text-amber-700'}`}>
                    Ultima verificacao no mapa: {latestOfferObservedLabel}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                className={`shrink-0 rounded-full p-2 ${
                  wazeUi ? 'text-[#888] hover:bg-[#1e2130]' : 'text-gray-600 hover:bg-gray-100'
                }`}
                aria-label="Fechar"
                onClick={() => setShopOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {wazeUi && shopOffers.length > 0 ? (
              <div className="finmemory-waze-scroll flex flex-shrink-0 gap-1.5 overflow-x-auto px-4 py-2.5">
                {shopOfferShelfCats.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setShopFilterCat(c)}
                    className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      shopFilterCat === c
                        ? 'border-[#2ecc71] bg-[#2ecc71] text-[#0f1117]'
                        : 'border-[#2a2d3a] bg-[#1a1d27] text-[#888] hover:border-[#2ecc71] hover:text-[#2ecc71]'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            ) : null}

            <div
              className={`min-h-0 flex-1 overflow-y-auto px-3 pb-8 ${wazeUi ? 'finmemory-waze-scroll' : ''}`}
            >
              <div
                className={`mb-2 mt-2 flex items-center justify-between rounded-lg px-2.5 py-2 text-[11px] ${
                  wazeUi
                    ? 'border border-[#2a2d3a] bg-[#1a1d27] text-[#bbb]'
                    : 'border border-amber-200 bg-amber-50 text-amber-900'
                }`}
              >
                <span>Precos podem variar na loja fisica. Compare antes de fechar compra.</span>
                <a
                  href={`/share-price?store=${encodeURIComponent(shopStore?.name || '')}&category=${encodeURIComponent('Supermercado - Promoção')}`}
                  className={`ml-3 shrink-0 rounded-full px-2.5 py-1 font-semibold no-underline ${
                    wazeUi ? 'bg-[#2ecc71] text-[#0f1117]' : 'bg-amber-500 text-white'
                  }`}
                >
                  Preco diferente
                </a>
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
                <p className={`py-6 text-center text-sm ${wazeUi ? 'text-[#888]' : 'text-gray-600'}`}>
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
                    className={`grid grid-cols-2 gap-2 pb-3 ${wazeUi ? 'gap-2.5 sm:grid-cols-3' : ''}`}
                  >
                    {shopPromotions.map((row) => (
                      <PromotionEncarteCard
                        key={row.id}
                        row={row}
                        wazeUi={wazeUi}
                        accentHex={shopAccent}
                        selected={selectedItems.includes(String(row.id))}
                        onToggle={() => toggleSelectedPromotionItem(row.id)}
                      />
                    ))}
                  </div>
                </>
              ) : null}
              {!shopLoading && shopOffers.length > 0 ? (
                <>
                  <div
                    className={`mb-3 overflow-hidden rounded-xl ${
                      wazeUi ? 'border border-[#2a2d3a]' : ''
                    }`}
                  >
                    <HeroOfferCarousel
                      sources={uniqueDisplayableImageUrls(
                        shopOffers.map((o) => ({
                          promo_image_url: o.promo_image_url,
                          categoria: o.category,
                          id: o.id,
                          produto: o.product_name,
                        }))
                      )}
                      storeTitle={shopStore?.name || ''}
                      count={shopOffers.length}
                    />
                  </div>
                  {wazeUi ? (
                    <div className="grid grid-cols-2 gap-2.5 pb-4 sm:grid-cols-3">
                      {filteredShopOffers.map((offer) => (
                        <WazeOfferCard
                          key={offer.id}
                          offer={offer}
                          selected={cartOfferIdSet.has(String(offer.id))}
                          onToggle={() => toggleCartOffer(offer)}
                          accentHex="#2ecc71"
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 pb-4">
                      {shopOffers.map((offer, i) => {
                        const pt = {
                          id: offer.id,
                          produto: offer.product_name,
                          categoria: offer.category || '',
                          promo_image_url: offer.promo_image_url,
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
                          <ProductOfferThumb
                            key={offer.id || i}
                            point={pt}
                            accentHex={shopAccent}
                            priceSlot={priceSlot}
                            selected={cartOfferIdSet.has(String(offer.id))}
                            interactive
                            onActivate={() => toggleCartOffer(offer)}
                          />
                        );
                      })}
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
