'use client';

import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';

/**
 * Ajusta padding inferior e/ou esquerdo do container Leaflet quando um painel cobre o mapa
 * (bottom sheet mobile ou sidebar desktop), para o centro útil acompanhar a área visível.
 * invalidateSize é debounced: chamadas em rajada (ex.: sheet com framer-motion) podem quebrar o Leaflet
 * (Cannot read properties of undefined (reading '_leaflet_pos')).
 */
export function MapBottomPaddingSync({ paddingPx = 0, paddingLeftPx = 0 }) {
  const map = useMap();
  const debounceRef = useRef(null);

  useEffect(() => {
    const el = map?.getContainer?.();
    if (!el) return undefined;
    const prevBottom = el.style.paddingBottom;
    const prevLeft = el.style.paddingLeft;
    const px = Math.max(0, Math.round(Number(paddingPx) || 0));
    const pxLeft = Math.max(0, Math.round(Number(paddingLeftPx) || 0));
    el.style.paddingBottom = px > 0 ? `${px}px` : '';
    el.style.paddingLeft = pxLeft > 0 ? `${pxLeft}px` : '';

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
      el.style.paddingBottom = prevBottom;
      el.style.paddingLeft = prevLeft;
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
