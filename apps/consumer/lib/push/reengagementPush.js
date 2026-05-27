/**
 * Push de reengajamento — OneSignal REST (quando configurado).
 * Sem credenciais: apenas log (não falha o cron).
 */

import { sendOneSignalToUser } from './oneSignalSend';

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
