'use client';

import { memo, useEffect, useMemo, useRef } from 'react';
import { LocateFixed } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MAP_DEFAULT_ZOOM,
  MAP_MAX_BOUNDS_VISCOSITY,
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  SAO_PAULO_CITY_CENTER,
  SAO_PAULO_STATE_MAX_BOUNDS,
  clampCenterToSaoPaulo,
  isInsideSaoPauloState,
} from '../../../lib/saoPauloStateMap';

function formatBrl(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function cn(...parts) {
  return parts.filter(Boolean).join(' ');
}

const MAPBOX_STYLE = 'mapbox/streets-v12';

function buildPriceMarkerHtml(store, isSelected) {
  const priceBg = store.isOpportunity ? '#16a34a' : '#2563eb';
  const ring = isSelected
    ? 'box-shadow:0 0 0 2px #fff,0 8px 20px rgba(0,0,0,.35);transform:scale(1.08);'
    : '';
  const star = store.isFavorite
    ? `<span style="position:absolute;top:-4px;right:-4px;width:14px;height:14px;border-radius:999px;background:#facc15;display:flex;align-items:center;justify-content:center;font-size:9px;line-height:1;">★</span>`
    : '';
  return `
    <div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-4px);${ring}">
      <div style="background:${priceBg};color:#fff;font-size:11px;font-weight:700;padding:3px 8px;border-radius:8px;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,.3);margin-bottom:4px;position:relative;">
        ${formatBrl(store.price)}
        <span style="position:absolute;left:50%;bottom:-3px;width:6px;height:6px;background:${priceBg};transform:translateX(-50%) rotate(45deg);"></span>
      </div>
      <div style="position:relative;width:34px;height:34px;border-radius:999px;background:${store.color || '#2563eb'};border:2px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(0,0,0,.25);">
        <span style="color:#fff;font-size:11px;font-weight:700;">${String(store.name || '?')[0]}</span>
        ${star}
      </div>
      <div style="margin-top:2px;font-size:9px;font-weight:600;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.8);max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center;">
        ${String(store.name || '').replace(/</g, '&lt;')}
      </div>
    </div>
  `;
}

function SkipPriceMapImpl({
  stores = [],
  selectedStore,
  onSelectStore,
  productName,
  onLocateMe,
  isLocating,
  centerLat,
  centerLng,
  userLat,
  userLng,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const userMarkerRef = useRef(null);
  const mapboxToken =
    typeof process !== 'undefined'
      ? String(process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '').trim()
      : '';

  const mapCenter = useMemo(() => {
    if (Number.isFinite(Number(userLat)) && Number.isFinite(Number(userLng))) {
      return clampCenterToSaoPaulo(userLat, userLng);
    }
    if (Number.isFinite(Number(centerLat)) && Number.isFinite(Number(centerLng))) {
      return clampCenterToSaoPaulo(centerLat, centerLng);
    }
    const withCoords = (stores || []).filter(
      (s) =>
        Number.isFinite(Number(s.lat)) &&
        Number.isFinite(Number(s.lng)) &&
        isInsideSaoPauloState(s.lat, s.lng)
    );
    if (withCoords.length) {
      const lat = withCoords.reduce((sum, s) => sum + Number(s.lat), 0) / withCoords.length;
      const lng = withCoords.reduce((sum, s) => sum + Number(s.lng), 0) / withCoords.length;
      return clampCenterToSaoPaulo(lat, lng);
    }
    return [...SAO_PAULO_CITY_CENTER];
  }, [userLat, userLng, centerLat, centerLng, stores]);

  const storesInSp = useMemo(
    () =>
      (stores || []).filter(
        (s) =>
          Number.isFinite(Number(s.lat)) &&
          Number.isFinite(Number(s.lng)) &&
          isInsideSaoPauloState(s.lat, s.lng)
      ),
    [stores]
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;
    if (!mapboxToken) return undefined;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: true,
      minZoom: MAP_MIN_ZOOM,
      maxZoom: MAP_MAX_ZOOM,
      maxBounds: SAO_PAULO_STATE_MAX_BOUNDS,
      maxBoundsViscosity: MAP_MAX_BOUNDS_VISCOSITY,
    }).setView(mapCenter, MAP_DEFAULT_ZOOM);

    L.tileLayer(
      `https://api.mapbox.com/styles/v1/${MAPBOX_STYLE}/tiles/256/{z}/{x}/{y}@2x?access_token=${encodeURIComponent(mapboxToken)}`,
      {
        attribution:
          '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: MAP_MAX_ZOOM,
        minZoom: MAP_MIN_ZOOM,
        tileSize: 256,
        zoomOffset: 0,
        bounds: SAO_PAULO_STATE_MAX_BOUNDS,
      }
    ).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);
    mapRef.current = map;

    const onResize = () => {
      try {
        map.invalidateSize();
      } catch {
        /* ignore */
      }
    };
    window.setTimeout(onResize, 80);
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init once; flyTo handles center updates
  }, [mapboxToken]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const zoom = Math.min(MAP_MAX_ZOOM, Math.max(MAP_MIN_ZOOM, map.getZoom() || MAP_DEFAULT_ZOOM));
    map.setView(mapCenter, zoom, { animate: true });
  }, [mapCenter]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    storesInSp.forEach((store) => {
      const lat = Number(store.lat);
      const lng = Number(store.lng);
      const isSelected = selectedStore === store.name;
      const icon = L.divIcon({
        className: 'fm-skip-price-marker',
        html: buildPriceMarkerHtml(store, isSelected),
        iconSize: [100, 70],
        iconAnchor: [50, 68],
      });

      const marker = L.marker([lat, lng], { icon, zIndexOffset: isSelected ? 1000 : 0 }).addTo(map);
      marker.on('click', () => onSelectStore?.(store.name));
      markersRef.current.push(marker);
    });
  }, [storesInSp, selectedStore, onSelectStore]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedStore) return;
    const store = (stores || []).find((s) => s.name === selectedStore);
    if (
      !store ||
      !Number.isFinite(Number(store.lat)) ||
      !Number.isFinite(Number(store.lng))
    ) {
      return;
    }
    map.flyTo([Number(store.lat), Number(store.lng)], Math.max(map.getZoom(), 14), {
      duration: 0.8,
    });
  }, [selectedStore, stores]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    if (!isInsideSaoPauloState(userLat, userLng)) return;

    const lat = Number(userLat);
    const lng = Number(userLng);

    const icon = L.divIcon({
      className: 'fm-skip-user-marker',
      html: `<div style="position:relative;width:18px;height:18px;">
        <div style="position:absolute;inset:-8px;border-radius:999px;background:rgba(59,130,246,.25);"></div>
        <div style="position:absolute;inset:0;border-radius:999px;background:#3b82f6;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);"></div>
      </div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
    userMarkerRef.current = L.marker([lat, lng], { icon, zIndexOffset: 500 }).addTo(map);
  }, [userLat, userLng]);

  if (!mapboxToken) {
    return (
      <div className="fixed inset-0 w-full h-full bg-[#0d1b2e] flex items-center justify-center p-6 z-0">
        <div className="max-w-sm text-center text-white/80 text-sm space-y-2">
          <p className="font-semibold text-white m-0">Mapbox sem token</p>
          <p className="m-0 text-white/50">
            Defina <code className="text-[#39FF14]">NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code> no build do
            retailer (mesmo token do app consumidor).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-full h-full bg-[#0d1b2e]">
      <div ref={containerRef} className="absolute inset-0 z-0" />

      <button
        type="button"
        onClick={onLocateMe}
        className="absolute top-16 left-3 w-10 h-10 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/20 shadow-md z-[20]"
        aria-label="Minha localização"
      >
        <LocateFixed className={cn('w-5 h-5 text-[#39FF14]', isLocating && 'animate-spin')} />
      </button>

      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[20] bg-black/50 backdrop-blur-sm px-4 py-1.5 rounded-full border border-white/10 max-w-[70%] pointer-events-none">
        <p className="text-xs font-bold text-white truncate m-0">{productName}</p>
      </div>
    </div>
  );
}

export const SkipPriceMap = memo(SkipPriceMapImpl);
