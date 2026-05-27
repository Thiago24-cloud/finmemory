import { isValidResolvedImage } from './externalProductImages';

/** URL usada no pin do mapa (https remota ou path same-origin seguro). */
export function isClientUsablePinLogoRef(url) {
  const s = String(url || '').trim();
  if (!s) return false;
  if (s.startsWith('/')) return /^\/(map-logos\/|api\/map\/)/i.test(s);
  return isValidResolvedImage(s);
}
