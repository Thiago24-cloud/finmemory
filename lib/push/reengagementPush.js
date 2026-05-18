/**
 * Push de reengajamento — OneSignal REST (quando configurado).
 * Sem credenciais: apenas log (não falha o cron).
 */

/**
 * @param {{ userId: string, name?: string, currentStreak?: number }} user
 * @returns {{ title: string, body: string }}
 */
export function buildInactivePushCopy(user) {
  const first =
    String(user.name || 'Jogador')
      .trim()
      .split(/\s+/)[0] || 'Jogador';
  const streak = Number(user.currentStreak) || 0;
  const streakLine =
    streak > 0
      ? `Sua ofensiva de ${streak} dia${streak === 1 ? '' : 's'} está em risco!`
      : 'Seu XP e suas missões diárias estão esperando por você.';

  return {
    title: `${first}, sentimos sua falta! 🔥`,
    body: `${streakLine} Volte hoje e não perca o ritmo no FinMemory.`,
  };
}

/**
 * @param {string} userId
 * @param {{ title: string, body: string, url?: string }} payload
 */
export async function sendOneSignalToUser(userId, payload) {
  const appId = process.env.ONESIGNAL_APP_ID?.trim();
  const apiKey = process.env.ONESIGNAL_REST_API_KEY?.trim();
  if (!appId || !apiKey) {
    return { ok: false, skipped: true, reason: 'onesignal_not_configured' };
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    process.env.NEXTAUTH_URL?.replace(/\/$/, '') ||
    'https://finmemory.com.br';

  const res = await fetch('https://api.onesignal.com/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${apiKey}`,
    },
    body: JSON.stringify({
      app_id: appId,
      include_external_user_ids: [String(userId)],
      channel_for_external_user_ids: 'push',
      headings: { en: payload.title, pt: payload.title },
      contents: { en: payload.body, pt: payload.body },
      url: payload.url || `${appUrl}/missoes`,
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      skipped: false,
      reason: json?.errors?.[0] || res.statusText,
      raw: json,
    };
  }

  return { ok: true, id: json?.id };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ id: string, name?: string, streak_current?: number }} user
 */
export async function sendReengagementPush(supabase, user) {
  const copy = buildInactivePushCopy({
    userId: user.id,
    name: user.name,
    currentStreak: user.streak_current,
  });

  const result = await sendOneSignalToUser(user.id, {
    title: copy.title,
    body: copy.body,
    url: undefined,
  });

  await supabase.from('reengagement_push_log').insert({
    user_id: user.id,
    campaign: 'inactive_48h',
    success: Boolean(result.ok),
    provider: result.skipped ? null : 'onesignal',
    error_message: result.ok ? null : String(result.reason || 'unknown'),
  });

  return result;
}
