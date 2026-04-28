/**
 * Alertas de proximidade (lista × mapa) — só em app nativo Capacitor.
 * RPC: `buscar_lojas_por_produtos_lista` (price_points + promocoes_supermercados).
 *
 * Nota sobre sugestões externas (ex. outro assistente): schemas com `lista_compras`,
 * `mapa_precos`, `supermercados`, PostGIS em `supermercados.localizacao` ou plugin Swift
 * `RegionMonitoring` não coincidem com este repositório. Aqui mantemos um serviço único em
 * JavaScript com @capacitor-community/background-geolocation nos dois SO; no iOS limitamos
 * quantidade de alvos (maxGeofencesIOS) para alinhar à recomendação de poucas regiões.
 */

import { mergeProximityConfig, PROXIMITY_DEFAULTS } from './proximityConfig.js';

export { mergeProximityConfig, PROXIMITY_DEFAULTS as DEFAULT_PROXIMITY_CONFIG };

const STORAGE_KEY = 'finmemory_proximity_alerts_v1';
const RADIUS_STORAGE_KEY = 'finmemory_proximity_radius_m_v1';
export const PROXIMITY_RADIUS_MIN_M = 300;
export const PROXIMITY_RADIUS_MAX_M = 500;
export const PROXIMITY_RADIUS_PRESETS = [450];
const DEFAULT_RADIUS_M = 450;

let watcherId = null;
let lastTargets = [];
const lastNotifiedAt = new Map();

/** @type {{ cooldownMs: number; distanceFilter: number; maxGeofencesIOS: number }} */
let runtimeProximityConfig = {
  cooldownMs: PROXIMITY_DEFAULTS.cooldownMinutos * 60 * 1000,
  distanceFilter: PROXIMITY_DEFAULTS.distanceFilter,
  maxGeofencesIOS: PROXIMITY_DEFAULTS.maxGeofencesIOS,
};

export function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Alias com nome sugerido em integrações externas */
export const calcularDistanciaMetros = haversineMeters;

function hashToNotificationId(s) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  const n = h % 2147483646;
  return n > 0 ? n : 1;
}

export function getProximityAlertsStored() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setProximityAlertsStored(enabled) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    /* ignore */
  }
}

function clampRadiusM(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_RADIUS_M;
  return Math.min(
    PROXIMITY_RADIUS_MAX_M,
    Math.max(PROXIMITY_RADIUS_MIN_M, Math.round(n))
  );
}

function snapToPresetRadiusM(value) {
  const n = clampRadiusM(value);
  let best = PROXIMITY_RADIUS_PRESETS[0];
  let bestDist = Math.abs(n - best);
  for (const p of PROXIMITY_RADIUS_PRESETS) {
    const d = Math.abs(n - p);
    if (d < bestDist) {
      best = p;
      bestDist = d;
    }
  }
  return best;
}

export function getProximityRadiusM() {
  if (typeof window === 'undefined') return DEFAULT_RADIUS_M;
  try {
    const raw = window.localStorage.getItem(RADIUS_STORAGE_KEY);
    if (raw == null || raw === '') return DEFAULT_RADIUS_M;
    return snapToPresetRadiusM(raw);
  } catch {
    return DEFAULT_RADIUS_M;
  }
}

export function setProximityRadiusM(meters) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(RADIUS_STORAGE_KEY, String(snapToPresetRadiusM(meters)));
  } catch {
    /* ignore */
  }
}

export async function fetchStoresForListProducts(supabase, productNames) {
  if (!supabase || !productNames?.length) return [];
  const uniq = [
    ...new Set(
      productNames
        .map((n) => String(n || '').trim())
        .filter((n) => n.length >= 2)
    ),
  ];
  if (uniq.length === 0) return [];

  const { data, error } = await supabase.rpc('buscar_lojas_por_produtos_lista', {
    produtos: uniq,
  });
  if (error) {
    console.warn('[FinMemory proximity] RPC:', error.message || error);
    return [];
  }
  return Array.isArray(data) ? data : [];
}

async function loadPlugins() {
  const { Capacitor, registerPlugin } = await import('@capacitor/core');
  const { Geolocation } = await import('@capacitor/geolocation');
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const BackgroundGeolocation = registerPlugin('BackgroundGeolocation');
  return { Capacitor, Geolocation, LocalNotifications, BackgroundGeolocation };
}

async function ensureAndroidChannel(LocalNotifications) {
  const { Capacitor } = await import('@capacitor/core');
  if (Capacitor.getPlatform() !== 'android') return;
  try {
    await LocalNotifications.createChannel({
      id: 'proximity-lista',
      name: 'Lista — perto da loja',
      description: 'Avisos quando um produto da lista está perto de um ponto do mapa',
      importance: 5,
      visibility: 1,
    });
  } catch (e) {
    console.warn('[FinMemory proximity] channel:', e);
  }
}

function notifyKey(row) {
  return `${row.lugar_id}|${row.produto_nome}`;
}

function canNotifyAgain(key) {
  const t = lastNotifiedAt.get(key);
  if (!t) return true;
  return Date.now() - t > runtimeProximityConfig.cooldownMs;
}

function markNotified(key) {
  lastNotifiedAt.set(key, Date.now());
  setTimeout(() => lastNotifiedAt.delete(key), runtimeProximityConfig.cooldownMs + 5000);
}

/** @returns {boolean} true se ainda está em cooldown para esta chave (não voltar a notificar). */
export function jaNotificou(chave) {
  return !canNotifyAgain(chave);
}

export function limparCacheNotificacoes() {
  lastNotifiedAt.clear();
}

async function runProximityCheck(
  { LocalNotifications },
  userLat,
  userLng,
  radiusM
) {
  if (!lastTargets.length) return;

  for (const row of lastTargets) {
    const dist = haversineMeters(userLat, userLng, row.lat, row.lng);
    if (dist > radiusM) continue;

    const key = notifyKey(row);
    if (!canNotifyAgain(key)) continue;
    markNotified(key);

    const produtoExemplo = String(row.produto_nome || 'item da sua lista').trim();
    const nomeLoja = String(row.nome_loja || 'uma loja próxima').trim();
    const body = `Os itens da sua lista (ex: ${produtoExemplo}) estão na ${nomeLoja} a menos de 4 quadras de você.`;

    await LocalNotifications.schedule({
      notifications: [
        {
          id: hashToNotificationId(key + Date.now()),
          title: 'Oferta Próxima! 📍',
          body,
          channelId: 'proximity-lista',
          schedule: { at: new Date(Date.now() + 400) },
          extra: {
            lugar_id: row.lugar_id,
            produto: row.produto_nome,
            loja: row.nome_loja,
          },
        },
      ],
    });
  }
}

/**
 * Força uma checagem imediata de proximidade ignorando o distanceFilter do watcher.
 * Útil para validar o radar logo após compilar/abrir o app.
 */
export async function forceProximityCheckNow({ radiusM: radiusInput = DEFAULT_RADIUS_M } = {}) {
  const radiusM = snapToPresetRadiusM(radiusInput);
  const { Capacitor, Geolocation, LocalNotifications } = await loadPlugins();
  if (!Capacitor.isNativePlatform()) {
    return { ok: false, reason: 'web' };
  }

  await ensureAndroidChannel(LocalNotifications);
  try {
    const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
    await runProximityCheck(
      { LocalNotifications },
      pos.coords.latitude,
      pos.coords.longitude,
      radiusM
    );
    return { ok: true };
  } catch (e) {
    console.warn('[FinMemory proximity] force check:', e);
    return { ok: false, reason: 'position_error' };
  }
}

/**
 * Atualiza o cache de alvos (lojas/pontos) a partir da lista pendente.
 */
export async function refreshProximityTargets(supabase, pendingProductNames) {
  const rows = await fetchStoresForListProducts(supabase, pendingProductNames);
  const { Capacitor } = await import('@capacitor/core');
  const max =
    Capacitor.getPlatform() === 'ios' ? runtimeProximityConfig.maxGeofencesIOS : rows.length;
  lastTargets = rows.slice(0, max);
  return lastTargets.length;
}

/**
 * Para o watcher de background. Por omissão limpa alvos em memória (útil ao desligar a feature).
 */
export async function stopProximityMonitoring({ clearTargets = true } = {}) {
  if (watcherId) {
    try {
      const { registerPlugin } = await import('@capacitor/core');
      const BackgroundGeolocation = registerPlugin('BackgroundGeolocation');
      await BackgroundGeolocation.removeWatcher({ id: watcherId });
    } catch (e) {
      console.warn('[FinMemory proximity] stop:', e);
    }
    watcherId = null;
  }
  if (clearTargets) {
    lastTargets = [];
  }
}

/**
 * Inicia watcher + pedidos de permissão. Chame `refreshProximityTargets` antes ou depois.
 */
export async function startProximityMonitoring({
  supabase,
  pendingProductNames,
  radiusM: radiusInput = DEFAULT_RADIUS_M,
  onUnauthorized,
  proximityConfig: proximityConfigPartial,
}) {
  const cfg = mergeProximityConfig(proximityConfigPartial);
  runtimeProximityConfig = {
    cooldownMs: cfg.cooldownMinutos * 60 * 1000,
    distanceFilter: cfg.distanceFilter,
    maxGeofencesIOS: cfg.maxGeofencesIOS,
  };

  const radiusM = snapToPresetRadiusM(radiusInput);
  const { Capacitor, Geolocation, LocalNotifications, BackgroundGeolocation } =
    await loadPlugins();

  if (!Capacitor.isNativePlatform()) {
    return { ok: false, reason: 'web' };
  }

  await Geolocation.requestPermissions().catch(() => {});
  const locPerm = await Geolocation.checkPermissions().catch(() => ({ location: 'denied' }));
  if (locPerm?.location === 'denied') {
    onUnauthorized?.('location');
    return { ok: false, reason: 'location' };
  }

  await LocalNotifications.requestPermissions().catch(() => {});
  const notifPerm = await LocalNotifications.checkPermissions().catch(() => ({
    display: 'denied',
  }));
  if (notifPerm?.display === 'denied') {
    onUnauthorized?.('notifications');
    return { ok: false, reason: 'notifications' };
  }

  await ensureAndroidChannel(LocalNotifications);
  await refreshProximityTargets(supabase, pendingProductNames);

  await stopProximityMonitoring({ clearTargets: false });

  try {
    const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
    await runProximityCheck(
      { LocalNotifications },
      pos.coords.latitude,
      pos.coords.longitude,
      radiusM
    );
  } catch (e) {
    console.warn('[FinMemory proximity] initial position:', e);
  }

  watcherId = await BackgroundGeolocation.addWatcher(
    {
      backgroundMessage:
        'Monitorando itens da sua lista perto de lojas do mapa de preços.',
      backgroundTitle: 'FinMemory — lista ativa',
      requestPermissions: true,
      stale: false,
      distanceFilter: runtimeProximityConfig.distanceFilter,
    },
    async (location, error) => {
      if (error) {
        if (error.code === 'NOT_AUTHORIZED') {
          onUnauthorized?.('location');
        }
        return;
      }
      if (!location) return;
      await runProximityCheck(
        { LocalNotifications },
        location.latitude,
        location.longitude,
        radiusM
      );
    }
  );

  return { ok: true, watcherId, targets: lastTargets.length };
}

// ─── Nomes alternativos (API unificada / integrações externas) ─────────────

/**
 * Alias de `startProximityMonitoring`. `userId` pode ser omitido: os nomes vêm em `pendingProductNames`.
 */
export async function iniciarMonitoramento(opts = {}) {
  const { supabase, pendingProductNames, radiusM, proximityConfig, onUnauthorized } = opts;
  return startProximityMonitoring({
    supabase,
    pendingProductNames,
    radiusM,
    onUnauthorized,
    proximityConfig,
  });
}

export async function pararMonitoramento() {
  await stopProximityMonitoring();
}

export async function sincronizarListaComGeofences(supabase, pendingProductNames) {
  return refreshProximityTargets(supabase, pendingProductNames);
}

export function monitoramentoAtivo() {
  return watcherId != null;
}
