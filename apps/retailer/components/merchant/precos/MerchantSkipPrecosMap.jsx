'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bell, ChevronLeft, Loader2, MapPin, Search, Star } from 'lucide-react';
import { painelApi } from '../../../lib/merchant/painelApiPaths';
import {
  CHAIN_LABELS,
  haversineKm,
  inferChainKeyFromStoreName,
  isAtacadoStoreName,
} from '../../../lib/merchant/compras/chainCompare';
import { SkipPriceMap } from './SkipPriceMap';
import { SkipBottomSheet } from './SkipBottomSheet';
import { SkipStoreCard } from './SkipStoreCard';

const FAVORITES_KEY = 'finmemory_parceiros_map_favorites_v1';
const FILTERS_KEY = 'finmemory_parceiros_map_filters_v1';

const RADIUS_OPTIONS = [
  { value: 0, label: 'Qualquer' },
  { value: 3, label: '3 km' },
  { value: 5, label: '5 km' },
  { value: 10, label: '10 km' },
  { value: 15, label: '15 km' },
];

const CHAIN_FILTERS = [
  { key: '', label: 'Todas' },
  { key: 'assai', label: 'Assaí' },
  { key: 'atacadao', label: 'Atacadão' },
  { key: 'sonda', label: 'Sonda' },
  { key: 'dia', label: 'DIA' },
];

function loadFavorites() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(FAVORITES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveFavorites(list) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

function loadSavedFilters() {
  if (typeof window === 'undefined') {
    return { onlyAtacado: false, radiusKm: 0, chainKey: '', onlyValidPromo: true };
  }
  try {
    const raw = window.localStorage.getItem(FILTERS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return {
      onlyAtacado: Boolean(parsed?.onlyAtacado),
      radiusKm: Number(parsed?.radiusKm) || 0,
      chainKey: String(parsed?.chainKey || ''),
      onlyValidPromo: parsed?.onlyValidPromo !== false,
    };
  } catch {
    return { onlyAtacado: false, radiusKm: 0, chainKey: '', onlyValidPromo: true };
  }
}

function isPromoStillValid(store) {
  const exp = store?.expires_at;
  if (!exp) return true;
  const d = new Date(exp);
  if (!Number.isFinite(d.getTime())) return true;
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);
  return end >= new Date();
}

/**
 * Mapa de preços estilo Skip — mapa atrás, busca por cima, preços reais do FinMemory.
 */
export function MerchantSkipPrecosMap({ storeLat, storeLng, onBack }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [focusedProductId, setFocusedProductId] = useState(null);
  const [selectedStore, setSelectedStore] = useState(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [location, setLocation] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [onlyAtacado, setOnlyAtacado] = useState(false);
  const [radiusKm, setRadiusKm] = useState(0);
  const [chainKey, setChainKey] = useState('');
  const [onlyValidPromo, setOnlyValidPromo] = useState(true);

  useEffect(() => {
    setFavorites(loadFavorites());
    const f = loadSavedFilters();
    setOnlyAtacado(f.onlyAtacado);
    setRadiusKm(f.radiusKm);
    setChainKey(f.chainKey);
    setOnlyValidPromo(f.onlyValidPromo);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        FILTERS_KEY,
        JSON.stringify({ onlyAtacado, radiusKm, chainKey, onlyValidPromo })
      );
    } catch {
      /* ignore */
    }
  }, [onlyAtacado, radiusKm, chainKey, onlyValidPromo]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(searchTerm.trim()), 300);
    return () => window.clearTimeout(t);
  }, [searchTerm]);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setIsLocating(false);
      },
      () => setIsLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  const loadPrices = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (debouncedQ) params.set('q', debouncedQ);
      const lat = location?.lat ?? storeLat;
      const lng = location?.lng ?? storeLng;
      if (lat != null && lng != null) {
        params.set('lat', String(lat));
        params.set('lng', String(lng));
      }
      const res = await fetch(`${painelApi.mapPrecosSearch}?${params.toString()}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || 'Erro ao buscar preços.');
        setData(null);
        return;
      }
      setData(json);
      if (!focusedProductId && json.products?.length) {
        const low = json.products.find((p) => p.lowStock);
        setFocusedProductId((low || json.products[0]).id);
      }
    } catch {
      setError('Erro de rede.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, location, storeLat, storeLng, focusedProductId]);

  useEffect(() => {
    void loadPrices();
  }, [loadPrices]);

  const products = data?.products || [];
  const focusedProduct = useMemo(() => {
    if (!products.length) return null;
    return products.find((p) => p.id === focusedProductId) || products[0];
  }, [products, focusedProductId]);

  useEffect(() => {
    if (focusedProduct && !debouncedQ) {
      setSearchTerm(focusedProduct.name);
    }
  }, [focusedProduct?.id]);

  useEffect(() => {
    setSelectedStore(null);
  }, [data?.product]);

  const origin = useMemo(() => {
    const lat = location?.lat ?? storeLat;
    const lng = location?.lng ?? storeLng;
    if (lat == null || lng == null) return null;
    return { lat: Number(lat), lng: Number(lng) };
  }, [location, storeLat, storeLng]);

  const mapStores = useMemo(() => {
    const stores = data?.mapStores || [];
    return stores.map((s) => ({
      ...s,
      isFavorite: favorites.includes(s.name),
      isOpportunity: false,
      chainKey: inferChainKeyFromStoreName(s.name || s.nome_loja),
      isAtacado: isAtacadoStoreName(s.name || s.nome_loja),
    }));
  }, [data?.mapStores, favorites]);

  const filteredStores = useMemo(() => {
    let list = showFavoritesOnly ? mapStores.filter((s) => s.isFavorite) : mapStores;

    if (onlyAtacado) {
      list = list.filter((s) => s.isAtacado);
    }
    if (chainKey) {
      list = list.filter((s) => s.chainKey === chainKey);
    }
    if (onlyValidPromo) {
      list = list.filter((s) => isPromoStillValid(s));
    }
    if (radiusKm > 0 && origin) {
      list = list.filter((s) => {
        if (s.lat == null || s.lng == null) return false;
        return haversineKm(origin.lat, origin.lng, Number(s.lat), Number(s.lng)) <= radiusKm;
      });
    }

    return [...list].sort((a, b) => a.price - b.price);
  }, [mapStores, showFavoritesOnly, onlyAtacado, chainKey, onlyValidPromo, radiusKm, origin]);

  const lowestPrice = filteredStores[0]?.price ?? 0;
  const highestPrice = filteredStores[filteredStores.length - 1]?.price ?? 0;

  const toggleFavorite = (storeName) => {
    setFavorites((prev) => {
      const next = prev.includes(storeName) ? prev.filter((s) => s !== storeName) : [...prev, storeName];
      saveFavorites(next);
      return next;
    });
  };

  const addToCesta = async () => {
    if (!focusedProduct) return;
    try {
      await fetch(painelApi.comprasCesta, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', insumoId: focusedProduct.id }),
      });
    } catch {
      /* silent */
    }
  };

  const handleNavigate = (lat, lng) => {
    if (lat == null || lng == null) return;
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
  };

  const displayItems = debouncedQ
    ? products.filter((p) => p.name.toLowerCase().includes(debouncedQ.toLowerCase()))
    : products.filter((p) => p.lowStock);

  const activeFilterCount =
    (onlyAtacado ? 1 : 0) + (radiusKm > 0 ? 1 : 0) + (chainKey ? 1 : 0) + (onlyValidPromo ? 1 : 0);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-[#0d1b2e]">
      {focusedProduct && !loading ? (
        <SkipPriceMap
          stores={filteredStores}
          selectedStore={selectedStore}
          onSelectStore={setSelectedStore}
          productName={data?.product || focusedProduct.name}
          onLocateMe={requestLocation}
          isLocating={isLocating}
          centerLat={storeLat}
          centerLng={storeLng}
          userLat={location?.lat}
          userLng={location?.lng}
        />
      ) : null}

      <button
        type="button"
        onClick={onBack}
        className="fixed top-4 left-4 z-[60] w-10 h-10 bg-black/50 backdrop-blur rounded-full flex items-center justify-center border border-white/20"
        aria-label="Voltar"
      >
        <ChevronLeft className="w-5 h-5 text-white" />
      </button>

      {loading ? (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-[#0d1b2e]">
          <Loader2 className="w-8 h-8 animate-spin text-[#39FF14]" />
        </div>
      ) : null}

      {!loading && focusedProduct ? (
        <SkipBottomSheet
          header={
            <div className="px-5 space-y-4 pb-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                <input
                  className="w-full pl-11 pr-4 h-14 text-sm rounded-2xl bg-white/5 border border-white/15 text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-[#39FF14]/50"
                  placeholder="Buscar insumo (ex: manga, pera, leite...)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/45 m-0">
                  Filtros do lojista{activeFilterCount ? ` · ${activeFilterCount}` : ''}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setOnlyAtacado((v) => !v)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                      onlyAtacado
                        ? 'bg-[#39FF14]/20 border-[#39FF14]/50 text-[#39FF14]'
                        : 'bg-white/5 border-white/15 text-white/70'
                    }`}
                  >
                    Só atacado
                  </button>
                  <button
                    type="button"
                    onClick={() => setOnlyValidPromo((v) => !v)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                      onlyValidPromo
                        ? 'bg-[#39FF14]/20 border-[#39FF14]/50 text-[#39FF14]'
                        : 'bg-white/5 border-white/15 text-white/70'
                    }`}
                  >
                    Promo válida
                  </button>
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border bg-white/5 border-white/15 text-white/70">
                    Raio
                    <select
                      value={radiusKm}
                      onChange={(e) => setRadiusKm(Number(e.target.value) || 0)}
                      className="bg-transparent text-white text-xs outline-none"
                    >
                      {RADIUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-[#0d1b2e]">
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                  {CHAIN_FILTERS.map((c) => (
                    <button
                      key={c.key || 'all'}
                      type="button"
                      onClick={() => setChainKey(c.key)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border ${
                        chainKey === c.key
                          ? 'bg-green-600 text-white border-green-500'
                          : 'bg-white/5 text-white/65 border-white/10'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center justify-between text-sm text-white/60 cursor-pointer">
                <span className="flex items-center gap-2">
                  <Star className="w-4 h-4" />
                  Mostrar apenas favoritos
                </span>
                <input
                  type="checkbox"
                  checked={showFavoritesOnly}
                  onChange={(e) => setShowFavoritesOnly(e.target.checked)}
                  className="accent-[#39FF14]"
                />
              </label>
              {displayItems.length > 0 ? (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {displayItems.slice(0, 30).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setFocusedProductId(p.id);
                        setSearchTerm(p.name);
                      }}
                      className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                        focusedProduct?.id === p.id
                          ? 'bg-green-600 text-white'
                          : 'bg-white/10 text-white/70 border border-white/10'
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              ) : null}
              {!debouncedQ && displayItems.length > 0 ? (
                <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-500/10 px-4 py-3 rounded-xl border border-amber-500/30">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Mostrando itens abaixo do estoque mínimo
                </div>
              ) : null}
              {location ? (
                <p className="text-[10px] text-white/40 m-0 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  Perto de mim · {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                </p>
              ) : null}
            </div>
          }
        >
          <div className="px-4 space-y-3 pt-2 pb-10">
            {error ? (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 m-0">
                {error}
              </p>
            ) : null}
            {data?.summary?.matched > 0 ? (
              <p className="text-xs font-semibold text-[#39FF14] m-0 flex items-center gap-2">
                <Bell className="w-4 h-4" />
                {filteredStores.length} mercado(s) · {data.product}
                {chainKey ? ` · ${CHAIN_LABELS[chainKey] || chainKey}` : ''}
              </p>
            ) : null}
            {filteredStores.length === 0 ? (
              <p className="text-center text-sm text-white/50 py-8 m-0">
                {showFavoritesOnly
                  ? 'Nenhum favorito. Toque na estrela de um mercado.'
                  : onlyAtacado || radiusKm > 0 || chainKey
                    ? 'Nenhum preço com esses filtros. Afrobe o raio ou desative “só atacado”.'
                    : 'Nenhum preço encontrado no mapa para este produto.'}
              </p>
            ) : (
              filteredStores.map((store) => {
                const isLowest = store.price === lowestPrice;
                const diff = highestPrice - store.price;
                const pct = highestPrice > 0 ? (diff / highestPrice) * 100 : 0;
                const dist =
                  origin && store.lat != null && store.lng != null
                    ? haversineKm(origin.lat, origin.lng, Number(store.lat), Number(store.lng))
                    : null;
                return (
                  <SkipStoreCard
                    key={store.name}
                    name={store.name}
                    color={store.color}
                    price={store.price}
                    address={
                      [
                        dist != null ? `${dist.toFixed(1)} km` : null,
                        store.expires_at ? `vál. ${String(store.expires_at).slice(0, 10)}` : null,
                        store.isAtacado ? 'atacado' : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    }
                    isLowest={isLowest}
                    savingsPercent={pct}
                    savingsAmount={diff}
                    isSelected={selectedStore === store.name}
                    isFavorite={store.isFavorite}
                    isOpportunity={store.isOpportunity}
                    onSelect={() => setSelectedStore(store.name)}
                    onAddToList={() => void addToCesta()}
                    onNavigate={() => handleNavigate(store.lat, store.lng)}
                    onToggleFavorite={() => toggleFavorite(store.name)}
                  />
                );
              })
            )}
            <p className="text-[10px] text-white/35 text-center pt-2 m-0">
              Preços reais do mapa FinMemory (sem demo). Filtros: atacado, raio, rede e validade.
            </p>
          </div>
        </SkipBottomSheet>
      ) : null}
    </div>
  );
}
