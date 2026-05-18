import { calendarDaysBetween, hoursSinceIso, todayBR, yesterdayBR } from './spTimezone';

const INACTIVE_WELCOME_BACK_HOURS = 48;
const STREAK_BREAK_HOURS = 48;

/**
 * Mapeia colunas do banco para nomes do produto.
 * @param {Record<string, unknown> | null | undefined} row
 */
export function mapStreakFields(row) {
  if (!row) {
    return {
      current_streak: 0,
      longest_streak: 0,
      streak_freeze_count: 0,
      last_login_at: null,
      last_streak_update: null,
    };
  }
  return {
    current_streak: Number(row.streak_current) || 0,
    longest_streak: Number(row.streak_max) || 0,
    streak_freeze_count: Number(row.streak_freeze_count) || 0,
    last_login_at: row.last_login_at || null,
    last_streak_update: row.last_streak_update || null,
    streak_last_action_date: row.streak_last_action_date || null,
    welcome_back_bonus_until: row.welcome_back_bonus_until || null,
  };
}

/**
 * Atualiza ofensiva e retorno após login ou abertura do app (sessão).
 * Regras:
 * - Mesmo dia: mantém streak
 * - Dia seguinte: +1
 * - 48h+ sem entrar: escudo consome e mantém, senão zera e recomeça em 1 hoje
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function processLoginEngagement(supabase, userId) {
  const nowIso = new Date().toISOString();
  const today = todayBR();

  const { data: user, error } = await supabase
    .from('users')
    .select(
      'id, name, streak_current, streak_max, streak_last_action_date, streak_freeze_count, last_login_at, last_streak_update, welcome_back_bonus_until, welcome_back_last_shown_at'
    )
    .eq('id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!user) throw new Error('Usuário não encontrado');

  const inactiveHours = hoursSinceIso(user.last_login_at);
  const showWelcomeBack =
    Boolean(user.last_login_at) && inactiveHours >= INACTIVE_WELCOME_BACK_HOURS;

  let currentStreak = Number(user.streak_current) || 0;
  let longestStreak = Number(user.streak_max) || 0;
  let freezeCount = Number(user.streak_freeze_count) || 0;
  let freezeUsed = false;
  let streakReset = false;
  let streakIncremented = false;

  const lastStreakDate = user.streak_last_action_date || null;
  const daysGap = lastStreakDate ? calendarDaysBetween(lastStreakDate, today) : null;

  if (daysGap === null) {
    currentStreak = 1;
    streakIncremented = true;
  } else if (daysGap === 0) {
    // mesmo dia — mantém
  } else if (daysGap === 1) {
    currentStreak += 1;
    streakIncremented = true;
  } else {
    const breakByTime = inactiveHours >= STREAK_BREAK_HOURS;
    if (breakByTime && freezeCount > 0) {
      freezeCount -= 1;
      freezeUsed = true;
      if (currentStreak < 1) currentStreak = 1;
    } else {
      currentStreak = 1;
      streakReset = true;
      streakIncremented = true;
    }
  }

  longestStreak = Math.max(longestStreak, currentStreak);

  const updates = {
    last_login_at: nowIso,
    last_streak_update: nowIso,
    streak_current: currentStreak,
    streak_max: longestStreak,
    streak_last_action_date: today,
    streak_freeze_count: freezeCount,
  };

  if (showWelcomeBack) {
    updates.welcome_back_bonus_until = today;
  }

  const { error: upErr } = await supabase.from('users').update(updates).eq('id', userId);
  if (upErr) throw new Error(upErr.message);

  const firstName = String(user.name || 'Jogador').trim().split(/\s+/)[0] || 'Jogador';
  const doubleXpToday = showWelcomeBack || user.welcome_back_bonus_until === today;

  return {
    ...mapStreakFields({ ...user, ...updates }),
    display_name: firstName,
    show_welcome_back: showWelcomeBack,
    double_xp_today: doubleXpToday,
    inactive_hours: Math.round(inactiveHours),
    freeze_used: freezeUsed,
    streak_reset: streakReset,
    streak_incremented: streakIncremented,
    bonus_copy:
      'Para recuperar o ritmo, sua próxima missão diária vai te dar DOBRO de XP hoje!',
  };
}

/**
 * Incremento por ação in-app (nota, mapa) — sem modal de retorno.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 */
export async function bumpStreakFromActivity(supabase, userId) {
  const today = todayBR();
  const yesterday = yesterdayBR();

  const { data: user, error } = await supabase
    .from('users')
    .select('streak_current, streak_max, streak_last_action_date')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!user) throw new Error('Usuário não encontrado');

  const lastDate = user.streak_last_action_date || null;
  if (lastDate === today) {
    return {
      streak_current: user.streak_current,
      streak_max: user.streak_max,
      updated: false,
    };
  }

  const isConsecutive = lastDate === yesterday;
  const newStreak = isConsecutive ? (Number(user.streak_current) || 0) + 1 : 1;
  const newMax = Math.max(newStreak, Number(user.streak_max) || 0);
  const nowIso = new Date().toISOString();

  const { error: upErr } = await supabase
    .from('users')
    .update({
      streak_current: newStreak,
      streak_max: newMax,
      streak_last_action_date: today,
      last_streak_update: nowIso,
    })
    .eq('id', userId);

  if (upErr) throw new Error(upErr.message);

  return { streak_current: newStreak, streak_max: newMax, updated: true };
}
