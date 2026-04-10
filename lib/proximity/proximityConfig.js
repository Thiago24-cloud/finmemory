/**
 * Configuração dos alertas de proximidade (alinhada à ideia de ProximityConfig unificado).
 * O raio em metros vem de getProximityRadiusM() / UI; o resto fica aqui.
 */

export const PROXIMITY_DEFAULTS = {
  /** Evita reenviar a mesma notificação (loja+produto) dentro deste intervalo */
  cooldownMinutos: 30,
  /** Mínimo de metros entre leituras GPS (plugin background-geolocation) */
  distanceFilter: 50,
  /** iOS: CoreLocation recomenda poucas regiões; limitamos alvos da RPC */
  maxGeofencesIOS: 20,
};

/**
 * @param {Partial<typeof PROXIMITY_DEFAULTS>} partial
 */
export function mergeProximityConfig(partial = {}) {
  return {
    cooldownMinutos:
      typeof partial.cooldownMinutos === 'number' && Number.isFinite(partial.cooldownMinutos)
        ? Math.max(1, Math.min(120, Math.round(partial.cooldownMinutos)))
        : PROXIMITY_DEFAULTS.cooldownMinutos,
    distanceFilter:
      typeof partial.distanceFilter === 'number' && Number.isFinite(partial.distanceFilter)
        ? Math.max(10, Math.min(500, Math.round(partial.distanceFilter)))
        : PROXIMITY_DEFAULTS.distanceFilter,
    maxGeofencesIOS:
      typeof partial.maxGeofencesIOS === 'number' && Number.isFinite(partial.maxGeofencesIOS)
        ? Math.max(1, Math.min(20, Math.round(partial.maxGeofencesIOS)))
        : PROXIMITY_DEFAULTS.maxGeofencesIOS,
  };
}
