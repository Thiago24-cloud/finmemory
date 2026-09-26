'use client';

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Loader2, MapPin, Navigation, Route, Store } from 'lucide-react';
import { fmtCurrency } from '../../../lib/adm/bridgeFormat';
import { buildConsumerMapUrl } from '../../../lib/consumerAppUrl';
import {
  openGoogleMapsDirectionsPreferCurrentLocation,
  openWazeNavigation,
} from '../../../lib/merchant/compras/googleMapsMultiStop';

const REGION_RADIUS_KM = 25;

function requestGeolocation() {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocalização não disponível neste navegador.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(new Error(err.message || 'Permissão de localização negada.')),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  });
}

function openRouteToStore(store, origin) {
  if (store?.lat == null || store?.lng == null) return;
  openGoogleMapsDirectionsPreferCurrentLocation(
    { lat: Number(store.lat), lng: Number(store.lng) },
    origin
  );
}

export function BridgeInsumoComprarPanel({ insumo, onClose, compact = false }) {
  const [location, setLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [data, setData] = useState(null);

  const loadStores = useCallback(
    async (coords) => {
      if (!insumo?.nome) return;
      setLoading(true);
      setErr('');
      try {
        const params = new URLSearchParams({ q: insumo.nome });
        if (insumo.ean) params.set('ean', insumo.ean);
        if (insumo.custo_medio != null) params.set('custo', String(insumo.custo_medio));
        params.set('radius_km', String(REGION_RADIUS_KM));
        if (coords?.lat != null && coords?.lng != null) {
          params.set('lat', String(coords.lat));
          params.set('lng', String(coords.lng));
        }
        const res = await fetch(`/api/parceiros/adm/bridge/insumos/comprar-onde?${params}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `Erro ${res.status}`);
        setData(json);
      } catch (e) {
        setErr(e.message);
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [insumo]
  );

  const ensureLocationAndLoad = useCallback(async () => {
    setLocating(true);
    setErr('');
    try {
      const coords = location || (await requestGeolocation());
      if (!location) setLocation(coords);
      await loadStores(coords);
    } catch (e) {
      setErr(e.message);
      await loadStores(null);
    } finally {
      setLocating(false);
    }
  }, [location, loadStores]);

  useEffect(() => {
    setData(null);
    setErr('');
    ensureLocationAndLoad();
  }, [insumo?.id, insumo?.nome]);

  const mapUrl =
    location && insumo?.nome
      ? buildConsumerMapUrl({
          lat: location.lat,
          lng: location.lng,
          lista: insumo.nome,
          from: 'bridge-catalogo',
          rota: Boolean(data?.best?.lat != null && data?.best?.lng != null),
        })
      : null;

  const panelClass = compact
    ? 'fm-bridge-comprar-panel fm-bridge-comprar-panel--compact'
    : 'fm-bridge-comprar-panel';

  const regionLabel =
    data?.precos_reais && data?.radius_km
      ? data.region_expanded
        ? `Preços reais — ampliado para ~${data.radius_km} km`
        : `Preços reais na sua região (~${data.radius_km} km)`
      : null;

  return (
    <div className={panelClass}>
      <div className="fm-bridge-comprar-panel-head">
        <div className="min-w-0">
          <p className="fm-bridge-comprar-kicker">Onde comprar</p>
          <h3 className="fm-bridge-comprar-title truncate">{insumo?.nome}</h3>
        </div>
        {onClose ? (
          <button type="button" className="fm-bridge-comprar-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        ) : null}
      </div>

      <div className="fm-bridge-comprar-actions">
        <button
          type="button"
          className="fm-bridge-comprar-locate"
          onClick={ensureLocationAndLoad}
          disabled={locating || loading}
        >
          {locating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Navigation className="w-4 h-4" />
          )}
          {location ? 'Atualizar perto de mim' : 'Usar minha localização'}
        </button>
        {mapUrl ? (
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="fm-bridge-comprar-map-link"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Ver no mapa
          </a>
        ) : null}
      </div>

      {regionLabel ? (
        <p className="fm-bridge-comprar-region-badge m-0">{regionLabel}</p>
      ) : null}

      {err ? (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{err}</p>
      ) : null}

      {loading || locating ? (
        <div className="fm-bridge-comprar-loading">
          <Loader2 className="w-5 h-5 animate-spin text-[#22a83a]" />
          <span>Buscando preços reais perto de você…</span>
        </div>
      ) : null}

      {!loading && data?.best ? (
        <div className="fm-bridge-comprar-highlight">
          <Store className="w-4 h-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="m-0 text-sm">
              Compre <strong>{data.product}</strong> na loja{' '}
              <strong>{data.best.nome_loja}</strong> por{' '}
              <strong>{fmtCurrency(data.best.preco)}</strong>
              {data.best.distance_km != null ? (
                <span className="text-[#6b7280]"> — {data.best.distance_km.toFixed(1)} km</span>
              ) : null}
            </p>
            {data.best.lat != null && data.best.lng != null ? (
              <div className="fm-bridge-comprar-route-row mt-2">
                <button
                  type="button"
                  className="fm-bridge-comprar-route-btn"
                  onClick={() => openRouteToStore(data.best, location)}
                >
                  <Route className="w-3.5 h-3.5" />
                  Rota até a loja
                </button>
                <button
                  type="button"
                  className="fm-bridge-comprar-route-btn fm-bridge-comprar-route-btn--ghost"
                  onClick={() =>
                    openWazeNavigation({ lat: Number(data.best.lat), lng: Number(data.best.lng) })
                  }
                >
                  Waze
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {!loading && data?.stores?.length ? (
        <ul className="fm-bridge-comprar-list">
          {data.stores.map((store, idx) => (
            <li key={`${store.nome_loja}-${idx}`} className="fm-bridge-comprar-item">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-[#111827] truncate m-0">{store.nome_loja}</p>
                <p className="text-xs text-[#6b7280] truncate m-0 mt-0.5">
                  {store.produto_nome || data.product}
                </p>
                {store.preco_real === false ? (
                  <span className="fm-bridge-comprar-demo-tag">Estimativa demo</span>
                ) : null}
              </div>
              <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                <div>
                  <p className="font-semibold text-[#22a83a] m-0">{fmtCurrency(store.preco)}</p>
                  {store.distance_km != null ? (
                    <p className="text-[10px] text-[#6b7280] m-0 mt-0.5 flex items-center justify-end gap-0.5">
                      <MapPin className="w-3 h-3" />
                      {store.distance_km.toFixed(1)} km
                    </p>
                  ) : null}
                </div>
                {store.lat != null && store.lng != null ? (
                  <button
                    type="button"
                    className="fm-bridge-comprar-route-btn fm-bridge-comprar-route-btn--sm"
                    onClick={() => openRouteToStore(store, location)}
                    title={`Rota até ${store.nome_loja}`}
                  >
                    <Route className="w-3 h-3" />
                    Rota
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {!loading && !locating && data && !data.stores?.length ? (
        <p className="text-sm text-[#6b7280] m-0">
          Nenhuma loja encontrada para este produto na sua região. Tente atualizar a localização ou
          buscar no mapa FinMemory.
        </p>
      ) : null}

      {data?.is_demo ? (
        <p className="text-[10px] text-[#6b7280] m-0 opacity-80">
          Sem ofertas reais no mapa para sua região — exibindo estimativas com base no custo médio.
        </p>
      ) : null}
    </div>
  );
}
