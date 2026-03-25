'use client';

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getMapThemeById } from '../lib/colors';
import { getCategoryColor } from '../lib/colors';

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

/** Cor de fundo do ícone por tipo (estabelecimentos no mapa) */
function storeTypeColor(type) {
  const t = String(type || '').toLowerCase();
  if (t === 'supermarket') return '#22c55e';
  if (t === 'pharmacy') return '#ef4444';
  if (t === 'bakery') return '#f97316';
  if (t === 'restaurant') return '#e11d48';
  return '#6366f1';
}

/** Ícones por tipo de estabelecimento (estilo Google Maps: cesta, cruz, garfo, etc.) */
function createStoreIcon(type, temOfertaHoje = false) {
  const bg = temOfertaHoje ? '#F59E0B' : storeTypeColor(type);
  const t = String(type || '').toLowerCase();
  let svg = '';
  if (t === 'supermarket') {
    svg = '<path fill="white" d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1z"/>';
  } else if (t === 'pharmacy') {
    svg = '<path fill="white" d="M19 3H5c-1.1 0-1.99.9-1.99 2L3 19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z"/>';
  } else if (t === 'bakery') {
    svg = '<path fill="white" d="M6 2c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2H6zm6 4c.55 0 1 .45 1 1v1h2c.55 0 1 .45 1 1s-.45 1-1 1h-2v2c0 .55-.45 1-1 1s-1-.45-1-1v-2H9c-.55 0-1-.45-1-1s.45-1 1-1h2V7c0-.55.45-1 1-1z"/>';
  } else if (t === 'restaurant') {
    svg = '<path fill="white" d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z"/>';
  } else {
    svg = '<path fill="white" d="M20 4H4v2h16V4zm1 10v-2l-1-5H4l-1 5v2h1v6h10v-6h4v6h2v-6h1zm-9 4H6v-4h6v4z"/>';
  }
  return L.divIcon({
    className: 'store-pin',
    html: `<div style="background:${bg};width:32px;height:32px;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"><svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">${svg}</svg></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  });
}

/**
 * Carrega estabelecimentos do banco (stores) na área visível do mapa e exibe com ícone por tipo.
 * Não altera os pins de preços compartilhados (price_points).
 */
function StoreMarkers({ storeFilterName = '' }) {
  const map = useMap();
  const [stores, setStores] = useState([]);

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
    if (!map) return;
    fetchStoresInBounds();
    map.on('moveend', fetchStoresInBounds);
    return () => map.off('moveend', fetchStoresInBounds);
  }, [map, fetchStoresInBounds]);

  const q = String(storeFilterName || '').trim().toLowerCase();
  const visibleStores = !q
    ? stores
    : stores.filter((s) => String(s.name || '').toLowerCase().includes(q));

  return (
    <>
      {visibleStores.map((store) => (
        <Marker
          key={store.id}
          position={[Number(store.lat), Number(store.lng)]}
          icon={createStoreIcon(store.type, !!store.tem_oferta_hoje)}
          zIndexOffset={-300}
        >
          <Popup>
            <div className="p-2 min-w-[180px]">
              <span
                className="inline-block px-2 py-0.5 rounded text-xs font-semibold text-white mb-1"
                style={{ backgroundColor: store.tem_oferta_hoje ? '#F59E0B' : storeTypeColor(store.type) }}
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
                    <ul className="mt-1 space-y-1 text-xs text-gray-700 pl-4 list-disc">
                      {store.offer_products.map((prod, i) => (
                        <li key={`${store.id}-offer-${i}`}>{prod}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}

/**
 * Localização no mapa: só pede ao utilizador depois de um toque no botão.
 * Em muitos telemóveis o browser bloqueia GPS se for pedido ao abrir a página.
 * onLocationFound(lat, lng) é chamado quando a localização é obtida (para geo-fencing).
 */
function LocationMarker({ onLocationFound }) {
  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const [locating, setLocating] = useState(false);
  const map = useMap();

  const requestLocation = useCallback(() => {
    if (!map) return;
    setError(null);
    setLocating(true);
    map.locate({ setView: true, maxZoom: 16, timeout: 15000, enableHighAccuracy: true });
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
      if (typeof onLocationFound === 'function') onLocationFound(lat, lng);
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
  }, [map, onLocationFound]);

  return (
    <>
      {position && (
        <Marker position={position} icon={DEFAULT_ICON}>
          <Popup>Você está aqui! 📍</Popup>
        </Marker>
      )}
      <div style={{ position: 'absolute', top: 70, right: 10, zIndex: 1000 }}>
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

/**
 * Busca pontos: com busca (q≥2) ignora viewport; sem busca envia bbox da área visível para aliviar API e DOM.
 */
async function fetchMapPoints(map, searchTrim) {
  try {
    const params = new URLSearchParams();
    if (searchTrim.length >= 2) {
      params.set('q', searchTrim);
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

/** Carrega/atualiza price_points conforme mapa (debounce no pan) ou busca global */
function PricePointsLoader({ searchQuery, setLocais, setCarregando, reloadRef }) {
  const map = useMap();
  const debounceRef = useRef(null);
  const searchTrim = (searchQuery || '').trim();
  const globalSearch = searchTrim.length >= 2;

  const load = useCallback(async () => {
    if (!map) return;
    setCarregando(true);
    try {
      const points = await fetchMapPoints(map, searchTrim);
      setLocais(points.filter((p) => !Number.isNaN(p.lat) && !Number.isNaN(p.lng)));
    } catch (error) {
      console.error('Erro ao buscar locais:', error);
    }
    setCarregando(false);
  }, [map, searchTrim, setLocais, setCarregando]);

  useEffect(() => {
    reloadRef.current = () => {
      load();
    };
  }, [load, reloadRef]);

  useEffect(() => {
    if (!map) return undefined;
    load();
    return undefined;
  }, [map, globalSearch, searchTrim, load]);

  useEffect(() => {
    if (!map || globalSearch) return undefined;
    const onMoveEnd = () => {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => load(), 400);
    };
    map.on('moveend', onMoveEnd);
    return () => {
      map.off('moveend', onMoveEnd);
      clearTimeout(debounceRef.current);
    };
  }, [map, globalSearch, load]);

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

export default function MapaPrecosLeaflet({ mapThemeId = 'verde', searchQuery = '', promoOnly = false }) {
  const theme = getMapThemeById(mapThemeId);
  const [locais, setLocais] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const reloadPointsRef = useRef(() => {});
  const [storeNearby, setStoreNearby] = useState(null);
  const [dismissedStorePrompt, setDismissedStorePrompt] = useState(false);
  const [storeFilter, setStoreFilter] = useState('');

  /** Lojas distintas nos preços carregados (chips de filtro por nome). */
  const storeNameOptions = useMemo(() => {
    const seen = new Set();
    const out = [];
    locais.forEach((p) => {
      const n = String(p.nome || '').trim();
      if (!n || seen.has(n)) return;
      seen.add(n);
      out.push(n);
    });
    return out.slice(0, 12);
  }, [locais]);

  /** Pins visíveis: busca + opcional “só promoções” + filtro por loja. */
  const visibleLocais = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let base = locais.filter((p) => !Number.isNaN(p.lat) && !Number.isNaN(p.lng));
    if (promoOnly) {
      base = base.filter(isPromoPoint);
    }
    const sf = storeFilter.trim().toLowerCase();
    if (sf) {
      base = base.filter((p) => (p.nome || '').toLowerCase().includes(sf));
    }
    if (q.length < 2) return base;
    return base.filter(
      (p) =>
        (p.produto || '').toLowerCase().includes(q) ||
        (p.nome || '').toLowerCase().includes(q) ||
        (p.categoria || '').toLowerCase().includes(q)
    );
  }, [locais, searchQuery, promoOnly, storeFilter]);

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

  const buscarLocais = useCallback(() => {
    reloadPointsRef.current();
  }, []);

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
        center={[-23.5505, -46.6333]}
        zoom={13}
        style={{ height: '100%', width: '100%', paddingTop: '56px' }}
        className="z-0"
      >
        <TileLayer
          attribution={theme.id === 'satelite'
            ? '&copy; Esri'
            : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; CARTO'}
          url={theme.url}
        />
        <LocationMarker onLocationFound={handleLocationFound} />
        <PricePointsLoader
          searchQuery={searchQuery}
          setLocais={setLocais}
          setCarregando={setCarregando}
          reloadRef={reloadPointsRef}
        />
        <StoreMarkers storeFilterName={storeFilter} />
        {groupPointsByLocation(visibleLocais).map((group, idx) => {
          const first = group.points[0];
          const { main } = getCategoryColor(first.categoria, first.nome);
          const count = group.points.length;
          const customIcon = createCategoryIcon(main, count);
          const priced = group.points.filter((p) => {
            const n = Number(p.preco);
            if (String(p.id || '').startsWith('promo-') && (!Number.isFinite(n) || n <= 0.01)) {
              return false;
            }
            return Number.isFinite(n) && n > 0;
          });
          const total = priced.reduce((s, p) => s + Number(p.preco), 0);
          const showTotal = priced.length > 1;
          return (
            <Marker
              key={`${group.lat}-${group.lng}-${idx}`}
              position={[group.lat, group.lng]}
              icon={customIcon}
              zIndexOffset={2500}
            >
              <Popup className="mapa-precos-popup-agrupado">
                <div className="p-2 min-w-[200px] max-w-[320px]">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span
                      className="inline-block px-2 py-0.5 rounded text-xs font-semibold text-white"
                      style={{ backgroundColor: main }}
                    >
                      {count === 1 ? (first.categoria || 'Outros') : `${count} itens`}
                    </span>
                    {showTotal && (
                      <span className="text-xs font-semibold text-gray-600">
                        Total: R$ {total.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-gray-900 text-base mt-1.5 mb-2">{group.nome || first.nome}</h3>
                  <div
                    className="space-y-2 max-h-[280px] overflow-y-auto pr-1 -mr-1"
                    style={{ scrollbarGutter: 'stable' }}
                  >
                    {group.points.map((p, i) => (
                      <div
                        key={p.id || i}
                        className="flex justify-between items-baseline gap-2 py-1.5 border-b border-gray-100 last:border-0"
                      >
                        <p className="text-sm text-gray-700 truncate flex-1 min-w-0" title={p.produto}>
                          {p.produto}
                        </p>
                        <p className="text-sm font-bold shrink-0" style={{ color: main }}>
                          {p.precoLabel != null ? (
                            p.precoLabel
                          ) : p.promo_image_url ? (
                            <a
                              href={p.promo_image_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline text-emerald-700"
                            >
                              Ver encarte
                            </a>
                          ) : (
                            'Encarte'
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                  {(first.time_ago || first.user_label) && count === 1 && (
                    <p className="text-xs text-gray-500 mt-2">
                      {[first.time_ago, first.user_label].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  {count > 1 && (
                    <p className="text-xs text-gray-500 mt-2">
                      {group.points.every((pt) => String(pt.id || '').startsWith('promo-'))
                        ? 'Encartes: o site não envia preço por item — abra cada link para ver a imagem.'
                        : 'Preços compartilhados pela comunidade'}
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
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

      <div className="absolute bottom-20 left-3 right-3 sm:left-4 sm:right-auto z-[1000] bg-white/95 backdrop-blur p-3 rounded-xl shadow-lg border border-gray-200/80 max-w-[280px]">
        {storeNameOptions.length > 0 && (
          <div className="mb-2">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Filtrar por loja</p>
            <div className="flex flex-wrap gap-1.5 max-h-[88px] overflow-y-auto pr-0.5">
              <button
                type="button"
                onClick={() => setStoreFilter('')}
                className={`min-h-[36px] px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                  !storeFilter
                    ? 'bg-emerald-500 text-white border-emerald-600'
                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                }`}
              >
                Todas
              </button>
              {storeNameOptions.map((name) => {
                const active = storeFilter === name;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setStoreFilter(active ? '' : name)}
                    title={name}
                    className={`min-h-[36px] max-w-[160px] truncate px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                      active
                        ? 'bg-emerald-500 text-white border-emerald-600'
                        : 'bg-white text-gray-800 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {name.length > 22 ? `${name.slice(0, 22)}…` : name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {locais.length === 0 && !carregando && (
          <p className="mt-1.5 text-xs text-gray-500">
            Nenhum preço compartilhado ainda. Use &quot;Compartilhar&quot; no topo ou busque um produto (ex: arroz).
          </p>
        )}
        {locais.length > 0 && visibleLocais.length === 0 && searchQuery.trim().length >= 2 && !carregando && (
          <p className="mt-1.5 text-xs text-amber-700 font-medium">
            Nenhum resultado para &quot;{searchQuery.trim()}&quot;. Limpe a busca para ver os {locais.length} preço(s) no mapa.
          </p>
        )}
        {visibleLocais.length > 0 && searchQuery.trim().length >= 2 && (
          <p className="mt-1.5 text-xs text-emerald-600 font-medium">
            {visibleLocais.length} de {locais.length} preço(s) com &quot;{searchQuery.trim()}&quot; — toque no ícone colorido do produto
          </p>
        )}
        {locais.length > 0 && searchQuery.trim().length < 2 && (
          <p className="mt-1.5 text-xs text-gray-500">
            Toque no círculo colorido (preços) para ver produtos; pins verdes/laranja são as lojas cadastradas
          </p>
        )}
        <button
          type="button"
          onClick={buscarLocais}
          disabled={carregando}
          className="mt-2 w-full py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 disabled:opacity-50"
        >
          {carregando ? 'Atualizando...' : 'Atualizar preços'}
        </button>
      </div>
    </div>
  );
}
