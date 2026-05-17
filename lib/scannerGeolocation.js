/**
 * Posição do utilizador para o scanner de código de barras (Capacitor ou browser).
 */

/**
 * @returns {Promise<{ lat: number, lng: number } | null>}
 */
export async function getScannerGeolocation() {
  if (typeof window === 'undefined') return null;

  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform()) {
      const { Geolocation } = await import('@capacitor/geolocation');
      const perm = await Geolocation.checkPermissions().catch(() => ({ location: 'denied' }));
      if (perm?.location === 'denied') {
        const req = await Geolocation.requestPermissions().catch(() => ({ location: 'denied' }));
        if (req?.location === 'denied') return null;
      }
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 12000,
      });
      const lat = Number(pos?.coords?.latitude);
      const lng = Number(pos?.coords?.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
  } catch {
    /* fallback browser */
  }

  if (typeof navigator !== 'undefined' && navigator.geolocation) {
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = Number(pos?.coords?.latitude);
          const lng = Number(pos?.coords?.longitude);
          if (Number.isFinite(lat) && Number.isFinite(lng)) resolve({ lat, lng });
          else resolve(null);
        },
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
      );
    });
  }

  return null;
}

/**
 * @param {number | null | undefined} meters
 */
export function formatDistanceShortPt(meters) {
  const m = Number(meters);
  if (!Number.isFinite(m) || m < 0) return '';
  if (m < 1000) return `${m} m`;
  const km = m / 1000;
  if (km < 10) return `${km.toFixed(1).replace('.', ',')} km`;
  return `${Math.round(km)} km`;
}
