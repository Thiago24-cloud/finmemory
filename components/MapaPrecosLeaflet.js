'use client';

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useEffect, useState, useCallback } from 'react';
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

function createCategoryIcon(hexColor) {
  return L.divIcon({
    className: 'custom-pin',
    html: `<div style="background:${hexColor};width:28px;height:28px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14]
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
function createStoreIcon(type) {
  const bg = storeTypeColor(type);
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
function StoreMarkers() {
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

  return (
    <>
      {stores.map((store) => (
        <Marker
          key={store.id}
          position={[Number(store.lat), Number(store.lng)]}
          icon={createStoreIcon(store.type)}
        >
          <Popup>
            <div className="p-2 min-w-[180px]">
              <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold text-white mb-1" style={{ backgroundColor: storeTypeColor(store.type) }}>
                {storeTypeLabel(store.type)}
              </span>
              <h3 className="font-bold text-gray-900 text-sm mt-1">{store.name}</h3>
              {store.address && <p className="text-xs text-gray-600 mt-0.5">{store.address}</p>}
              {store.neighborhood && <p className="text-xs text-gray-500">{store.neighborhood}</p>}
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
  }, [map]);

  return (
    <>
      {position && (
        <Marker position={position} icon={DEFAULT_ICON}>
          <Popup>Você está aqui! 📍</Popup>
        </Marker>
      )}
      {/* Botão: pedir localização só ao toque (necessário em mobile) */}
      <div style={{ position: 'absolute', top: 70, right: 10, zIndex: 1000 }}>
        <button
          type="button"
          onClick={requestLocation}
          disabled={locating}
          className="bg-white border border-gray-300 shadow-md rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 flex items-center gap-1.5"
          title="Centrar mapa na minha localização"
        >
          {locating ? (
            <>⏳ A obter...</>
          ) : (
            <>📍 Minha localização</>
          )}
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

/** Busca compras compartilhadas no mapa. Se searchQuery, filtra por nome do produto. */
async function fetchMapPoints(searchQuery = '') {
  try {
    const url = searchQuery.trim().length >= 2
      ? `/api/map/points?q=${encodeURIComponent(searchQuery.trim())}`
      : '/api/map/points';
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    const points = json.points || [];
    return points.map((p) => ({
      id: p.id,
      nome: p.store_name,
      produto: p.product_name,
      preco: p.price,
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

export default function MapaPrecosLeaflet({ mapThemeId = 'verde', searchQuery = '' }) {
  const theme = getMapThemeById(mapThemeId);
  const [locais, setLocais] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [storeNearby, setStoreNearby] = useState(null);
  const [dismissedStorePrompt, setDismissedStorePrompt] = useState(false);

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

  const buscarLocais = useCallback(async (query = searchQuery) => {
    setCarregando(true);
    try {
      const points = await fetchMapPoints(query);
      setLocais(points.filter((p) => !Number.isNaN(p.lat) && !Number.isNaN(p.lng)));
    } catch (error) {
      console.error('Erro ao buscar locais:', error);
    }
    setCarregando(false);
  }, [searchQuery]);

  useEffect(() => {
    buscarLocais(searchQuery);
  }, [searchQuery, buscarLocais]);

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
        <StoreMarkers />
        {groupPointsByLocation(locais).map((group, idx) => {
          const first = group.points[0];
          const { main } = getCategoryColor(first.categoria, first.nome);
          const customIcon = createCategoryIcon(main);
          const total = group.points.reduce((s, p) => s + Number(p.preco || 0), 0);
          const count = group.points.length;
          return (
            <Marker
              key={`${group.lat}-${group.lng}-${idx}`}
              position={[group.lat, group.lng]}
              icon={customIcon}
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
                    {count > 1 && (
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
                          R$ {Number(p.preco).toFixed(2)}
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
                      Preços compartilhados pela comunidade
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
        {locais.length === 0 && !carregando && (
          <p className="mt-1.5 text-xs text-gray-500">
            {searchQuery.trim().length >= 2
              ? `Nenhum preço de &quot;${searchQuery.trim()}&quot; compartilhado ainda. Compartilhe o primeiro!`
              : 'Nenhum preço compartilhado ainda. Use "Compartilhar" no topo ou busque um produto (ex: arroz).'}
          </p>
        )}
        {locais.length > 0 && searchQuery.trim().length >= 2 && (
          <p className="mt-1.5 text-xs text-emerald-600 font-medium">
            {locais.length} preço(s) de &quot;{searchQuery.trim()}&quot; — toque no ícone para ver a lista
          </p>
        )}
        {locais.length > 0 && searchQuery.trim().length < 2 && (
          <p className="mt-1.5 text-xs text-gray-500">
            Toque em um ícone para ver todos os produtos e preços daquele local
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
