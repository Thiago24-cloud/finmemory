'use client';

import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';

/**
 * Ajusta padding inferior do container Leaflet quando um bottom sheet cobre o mapa,
 * para o centro útil acompanhar a área visível (estilo Google Maps).
 * invalidateSize é debounced: chamadas em rajada (ex.: sheet com framer-motion) podem quebrar o Leaflet
 * (Cannot read properties of undefined (reading '_leaflet_pos')).
 */
export function MapBottomPaddingSync({ paddingPx = 0 }) {
  const map = useMap();
  const debounceRef = useRef(null);

  useEffect(() => {
    const el = map?.getContainer?.();
    if (!el) return undefined;
    const prev = el.style.paddingBottom;
    const px = Math.max(0, Math.round(Number(paddingPx) || 0));
    el.style.paddingBottom = px > 0 ? `${px}px` : '';

    const scheduleInvalidate = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        if (!map || typeof map.invalidateSize !== 'function') return;
        try {
          map.invalidateSize({ animate: false });
        } catch (_) {
          /* painel/markers a reconciliar */
        }
      }, 48);
    };

    scheduleInvalidate();

    return () => {
      el.style.paddingBottom = prev;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        if (!map || typeof map.invalidateSize !== 'function') return;
        try {
          map.invalidateSize({ animate: false });
        } catch (_) {
          /* ignore */
        }
      }, 48);
    };
  }, [map, paddingPx]);

  return null;
}
