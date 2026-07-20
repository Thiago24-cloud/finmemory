'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  ChevronLeft,
  Loader2,
  MapPin,
  Plus,
  Scale,
  Search,
  Star,
  X,
} from 'lucide-react';
import {
  CHAIN_LABELS,
  haversineKm,
  inferChainKeyFromStoreName,
  isAtacadoStoreName,
} from './chainFilters';
import { SkipPriceMap } from './SkipPriceMap';
import { SkipBottomSheet } from './SkipBottomSheet';
import { SkipStoreCard } from './SkipStoreCard';

const FAVORITES_KEY = 'finmemory_map_favorites_v1';
const DRAFT_KEY = 'finmemory_consumer_lista_mapa_v1';

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

function loadJson(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : fallback;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

function normalizeName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 80);
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
 * Mapa FinMemory unificado (estrutura Skip dos lojistas) — app consumidor e Parceiros embed.
 */
export function ConsumerMapaSkip({
  onBack,
  initialQuery = '',
  parceirosMode = false,
  centerLat = null,
  centerLng = null,
}) {
  const bootItems = useMemo(() => {
    return String(initialQuery || '')
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 2)
      .slice(0, 24);
  }, [initialQuery]);

  const [searchTerm, setSearchTerm] = useState(
    bootItems.length === 1 ? bootItems[0] : ''
  );
  const [debouncedQ, setDebouncedQ] = useState(
    bootItems.length === 1 ? bootItems[0] : bootItems.length > 1 ? bootItems.join(',') : ''
  );
  const [selectedStore, setSelectedStore] = useState(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [location, setLocation] = useState(() => {
    if (Number.isFinite(Number(centerLat)) && Number.isFinite(Number(centerLng))) {
      return { lat: Number(centerLat), lng: Number(centerLng) };
    }
    return null;
  });
  const [isLocating, setIsLocating] = useState(false);
  const [onlyAtacado, setOnlyAtacado] = useState(false);
  const [radiusKm, setRadiusKm] = useState(0);
  const [chainKey, setChainKey] = useState('');
  const [onlyValidPromo, setOnlyValidPromo] = useState(true);
  const [workMode, setWorkMode] = useState(bootItems.length > 1 ? 'montar' : 'explorar');
  const [draftList, setDraftList] = useState(() => (bootItems.length > 1 ? bootItems : []));
  const [listCompareLoading, setListCompareLoading] = useState(false);
  const bootAppliedRef = useRef('');

  useEffect(() => {
    setFavorites(loadJson(FAVORITES_KEY, []));
    if (bootItems.length > 1) return;
    const saved = loadJson(DRAFT_KEY, []);
    if (Array.isArray(saved) && saved.length) setDraftList(saved);
  }, [bootItems.length]);

  useEffect(() => {
    saveJson(DRAFT_KEY, draftList);
  }, [draftList]);

  /** Query da URL (?lista= / cesta) — aplica uma vez por valor. */
  useEffect(() => {
    const key = bootItems.join('|');
    if (!key || bootAppliedRef.current === key) return;
    bootAppliedRef.current = key;
    if (bootItems.length > 1) {
      setWorkMode('montar');
      setDraftList(bootItems);
      setSearchTerm('');
      setDebouncedQ(bootItems.join(','));
    } else if (bootItems.length === 1) {
      setWorkMode('explorar');
      setSearchTerm(bootItems[0]);
      setDebouncedQ(bootItems[0]);
    }
  }, [bootItems]);

  useEffect(() => {
    if (
      Number.isFinite(Number(centerLat)) &&
      Number.isFinite(Number(centerLng))
    ) {
      setLocation({ lat: Number(centerLat), lng: Number(centerLng) });
    }
  }, [centerLat, centerLng]);

  useEffect(() => {
    if (workMode === 'montar') return undefined;
    const t = window.setTimeout(() => setDebouncedQ(searchTerm.trim()), 350);
    return () => window.clearTimeout(t);
  }, [searchTerm, workMode]);

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
    if (Number.isFinite(Number(centerLat)) && Number.isFinite(Number(centerLng))) return;
    requestLocation();
  }, [requestLocation, centerLat, centerLng]);

  const loadPrices = useCallback(async (query) => {
    const q = String(query || '').trim();
    if (q.length < 2) {
      setData(null);
      setError('');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ q });
      if (location?.lat != null && location?.lng != null) {
        params.set('lat', String(location.lat));
        params.set('lng', String(location.lng));
      }
      const res = await fetch(`/api/map/precos-search?${params.toString()}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || 'Erro ao buscar preços.');
        setData(null);
        return;
      }
      setData(json);
    } catch {
      setError('Erro de rede.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [location]);

  useEffect(() => {
    if (workMode === 'explorar') {
      void loadPrices(debouncedQ);
      return;
    }
    /** Lista da URL (?lista=a,b) ou comparar — vários nomes separados por vírgula. */
    if (workMode === 'montar' && String(debouncedQ).includes(',')) {
      void loadPrices(debouncedQ);
    }
  }, [debouncedQ, workMode, loadPrices]);

  const addSearchToDraft = () => {
    const name = normalizeName(searchTerm);
    if (name.length < 2) return;
    setDraftList((prev) => {
      const key = name.toLowerCase();
      if (prev.some((p) => p.toLowerCase() === key)) return prev;
      return [...prev, name].slice(0, 24);
    });
    setSearchTerm('');
  };

  const removeDraftItem = (name) => {
    setDraftList((prev) => prev.filter((n) => n !== name));
  };

  const compareDraftList = async () => {
    if (!draftList.length) return;
    setListCompareLoading(true);
    setWorkMode('montar');
    await loadPrices(draftList.join(','));
    setListCompareLoading(false);
  };

  const origin = useMemo(() => {
    if (location?.lat == null || location?.lng == null) return null;
    return { lat: Number(location.lat), lng: Number(location.lng) };
  }, [location]);

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
    if (onlyAtacado) list = list.filter((s) => s.isAtacado);
    if (chainKey) list = list.filter((s) => s.chainKey === chainKey);
    if (onlyValidPromo) list = list.filter((s) => isPromoStillValid(s));
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
      const next = prev.includes(storeName)
        ? prev.filter((s) => s !== storeName)
        : [...prev, storeName];
      saveJson(FAVORITES_KEY, next);
      return next;
    });
  };

  const handleNavigate = (lat, lng) => {
    if (lat == null || lng == null) return;
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
  };

  const productLabel = data?.product || draftList.join(', ') || 'FinMemory';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-[#0d1b2e]">
      <SkipPriceMap
        stores={filteredStores}
        selectedStore={selectedStore}
        onSelectStore={setSelectedStore}
        productName={productLabel}
        onLocateMe={requestLocation}
        isLocating={isLocating}
        centerLat={location?.lat}
        centerLng={location?.lng}
        userLat={location?.lat}
        userLng={location?.lng}
      />

      {!parceirosMode && typeof onBack === 'function' ? (
        <button
          type="button"
          onClick={onBack}
          className="fixed top-4 left-4 z-[60] w-10 h-10 bg-black/50 backdrop-blur rounded-full flex items-center justify-center border border-white/20"
          aria-label="Voltar"
        >
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
      ) : null}

      {loading || listCompareLoading ? (
        <div className="fixed top-4 right-4 z-[60] rounded-full bg-black/50 border border-white/20 p-2">
          <Loader2 className="w-5 h-5 animate-spin text-[#39FF14]" />
        </div>
      ) : null}

      <SkipBottomSheet
        header={
          <div className="px-5 space-y-4 pb-4">
            <div className="flex gap-1 rounded-xl bg-white/5 border border-white/10 p-1">
              <button
                type="button"
                onClick={() => setWorkMode('explorar')}
                className={`flex-1 rounded-lg px-2 py-2 text-xs font-bold ${
                  workMode === 'explorar' ? 'bg-green-600 text-white' : 'text-white/55'
                }`}
              >
                Explorar preço
              </button>
              <button
                type="button"
                onClick={() => setWorkMode('montar')}
                className={`flex-1 rounded-lg px-2 py-2 text-xs font-bold ${
                  workMode === 'montar' ? 'bg-green-600 text-white' : 'text-white/55'
                }`}
              >
                Montar lista
              </button>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                <input
                  className="w-full pl-11 pr-4 h-14 text-sm rounded-2xl bg-white/5 border border-white/15 text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-[#39FF14]/50"
                  placeholder={
                    workMode === 'montar'
                      ? 'Digite e + para adicionar (sem buscar ainda)'
                      : 'Buscar produto (ex: arroz, leite, bolacha...)'
                  }
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (workMode === 'montar') addSearchToDraft();
                      else setDebouncedQ(searchTerm.trim());
                    }
                  }}
                />
              </div>
              <button
                type="button"
                onClick={addSearchToDraft}
                disabled={normalizeName(searchTerm).length < 2}
                className="shrink-0 w-14 h-14 rounded-full bg-[#39FF14] text-[#050508] flex items-center justify-center disabled:opacity-40"
                aria-label="Adicionar à lista"
              >
                <Plus className="w-6 h-6" aria-hidden />
              </button>
            </div>

            {draftList.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-white/70 m-0">
                    Minha lista ({draftList.length})
                  </p>
                  <button
                    type="button"
                    onClick={() => void compareDraftList()}
                    disabled={listCompareLoading}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#39FF14]/20 border border-[#39FF14]/40 px-3 py-1 text-[11px] font-bold text-[#39FF14] disabled:opacity-50"
                  >
                    <Scale className="w-3 h-3" aria-hidden />
                    Comparar preços
                  </button>
                </div>
                <ul className="flex flex-wrap gap-1.5 list-none p-0 m-0">
                  {draftList.map((name) => (
                    <li
                      key={name}
                      className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 pl-2.5 pr-1 py-1 text-[11px] font-semibold text-white"
                    >
                      {name}
                      <button
                        type="button"
                        onClick={() => removeDraftItem(name)}
                        className="rounded-full p-0.5 text-white/50 hover:text-white"
                        aria-label={`Remover ${name}`}
                      >
                        <X className="w-3 h-3" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : workMode === 'montar' ? (
              <p className="text-[11px] text-white/45 m-0">
                Adicione os produtos com + e depois compare os preços.
              </p>
            ) : null}

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

          {filteredStores.length > 0 ? (
            <p className="text-xs font-semibold text-[#39FF14] m-0 flex items-center gap-2">
              <Bell className="w-4 h-4" />
              {filteredStores.length} mercado(s)
              {data?.product ? ` · ${data.product}` : ''}
              {chainKey ? ` · ${CHAIN_LABELS[chainKey] || chainKey}` : ''}
            </p>
          ) : null}

          {filteredStores.length === 0 ? (
            <p className="text-center text-sm text-white/50 py-8 m-0">
              {workMode === 'montar' && !data
                ? 'Monte a lista e toque em Comparar preços.'
                : showFavoritesOnly
                  ? 'Nenhum favorito.'
                  : 'Busque um produto para ver preços no mapa.'}
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
                  onAddToList={() => {
                    const name = normalizeName(data?.product || searchTerm);
                    if (name.length >= 2) {
                      setDraftList((prev) => {
                        if (prev.some((p) => p.toLowerCase() === name.toLowerCase())) return prev;
                        return [...prev, name].slice(0, 24);
                      });
                    }
                  }}
                  onNavigate={() => handleNavigate(store.lat, store.lng)}
                  onToggleFavorite={() => toggleFavorite(store.name)}
                />
              );
            })
          )}
          <p className="text-[10px] text-white/35 text-center pt-2 m-0">
            Mapa FinMemory unificado — mesma estrutura do app Parceiros.
          </p>
        </div>
      </SkipBottomSheet>
    </div>
  );
}
