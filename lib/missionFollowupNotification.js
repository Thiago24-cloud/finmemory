'use client';

export const MISSION_FOLLOWUP_NOTIFICATION_ID = 902001;
const MISSION_CHANNEL_ID = 'mission-followup';
const MISSION_ACTIVE_KEY = 'finmemory_mission_active_v1';

async function loadPlugins() {
  const { Capacitor } = await import('@capacitor/core');
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  return { Capacitor, LocalNotifications };
}

async function ensureAndroidChannel(LocalNotifications) {
  const { Capacitor } = await import('@capacitor/core');
  if (Capacitor.getPlatform() !== 'android') return;
  try {
    await LocalNotifications.createChannel({
      id: MISSION_CHANNEL_ID,
      name: 'Missao de economia',
      description: 'Lembrete para escanear nota apos concluir a rota',
      importance: 5,
      visibility: 1,
    });
  } catch (_) {
    // ignore channel conflicts
  }
}

export async function scheduleMissionFollowupNotification({
  delayMinutes = 30,
  estimatedSavings = 0,
  stopsCount = 0,
} = {}) {
  try {
    const { Capacitor, LocalNotifications } = await loadPlugins();
    if (!Capacitor.isNativePlatform()) return { ok: false, reason: 'web' };

    await LocalNotifications.requestPermissions().catch(() => {});
    const perms = await LocalNotifications.checkPermissions().catch(() => ({ display: 'denied' }));
    if (perms?.display === 'denied') return { ok: false, reason: 'notifications' };

    await ensureAndroidChannel(LocalNotifications);
    await LocalNotifications.cancel({ notifications: [{ id: MISSION_FOLLOWUP_NOTIFICATION_ID }] }).catch(() => {});

    const savingsLabel =
      Number.isFinite(Number(estimatedSavings)) && Number(estimatedSavings) > 0
        ? `economia estimada de R$ ${Number(estimatedSavings).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : 'sua economia de hoje';
    const stopsLabel = Number(stopsCount) > 0 ? `${Number(stopsCount)} parada(s)` : 'sua rota';

    await LocalNotifications.schedule({
      notifications: [
        {
          id: MISSION_FOLLOWUP_NOTIFICATION_ID,
          title: 'Como foi a economia?',
          body: `Concluiu ${stopsLabel} com ${savingsLabel}? Escaneie a nota agora para manter seu limite sob controle.`,
          channelId: MISSION_CHANNEL_ID,
          schedule: { at: new Date(Date.now() + Math.max(1, Number(delayMinutes) || 30) * 60 * 1000) },
          extra: {
            kind: 'mission-followup',
          },
        },
      ],
    });
    if (typeof window !== 'undefined') {
      const payload = {
        scheduledAt: Date.now(),
        delayMinutes: Math.max(1, Number(delayMinutes) || 30),
        estimatedSavings: Number(estimatedSavings) || 0,
        stopsCount: Number(stopsCount) || 0,
      };
      window.localStorage.setItem(MISSION_ACTIVE_KEY, JSON.stringify(payload));
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error?.message || 'schedule_failed' };
  }
}

export async function cancelMissionFollowupNotification() {
  try {
    const { Capacitor, LocalNotifications } = await loadPlugins();
    if (!Capacitor.isNativePlatform()) return { ok: false, reason: 'web' };
    await LocalNotifications.cancel({ notifications: [{ id: MISSION_FOLLOWUP_NOTIFICATION_ID }] });
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error?.message || 'cancel_failed' };
  }
}

export function getMissionActiveContext() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(MISSION_ACTIVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return data;
  } catch (_) {
    return null;
  }
}

export function clearMissionActiveContext() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(MISSION_ACTIVE_KEY);
}
