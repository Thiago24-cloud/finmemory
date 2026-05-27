import { useEffect, useRef } from 'react';

/**
 * Envia posição ao backend (debounced) para push de ofertas no raio.
 * @param {{ lat?: number, lng?: number } | null} position
 * @param {boolean} enabled
 */
export function useReportUserLocation(position, enabled) {
  const lastSentRef = useRef('');

  useEffect(() => {
    if (!enabled || !position) return undefined;
    const lat = Number(position.lat);
    const lng = Number(position.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;

    const key = `${lat.toFixed(4)}:${lng.toFixed(4)}`;
    if (lastSentRef.current === key) return undefined;

    const timer = setTimeout(() => {
      lastSentRef.current = key;
      fetch('/api/user/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng }),
      }).catch(() => {});
    }, 2500);

    return () => clearTimeout(timer);
  }, [enabled, position?.lat, position?.lng]);
}
