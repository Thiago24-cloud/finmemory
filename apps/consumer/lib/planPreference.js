/**
 * Resolve home do utilizador a partir da BD (SSR / API).
 */
import { resolveAppHomePath } from './productPlansCatalog';

export async function fetchUserPlanPreference(supabase, userId) {
  if (!supabase || !userId) return null;
  const { data, error } = await supabase
    .from('users')
    .select('preferred_audience, preferred_plan, plan_trial_ends_at, plano, plano_ativo')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    // Colunas ainda não migradas
    if (/preferred_audience|plan_trial_ends_at|column/i.test(error.message || '')) {
      return { preferred_audience: null, preferred_plan: null, plan_trial_ends_at: null };
    }
    console.warn('[planPreference]', error.message);
    return null;
  }
  return data;
}

export function homePathFromPreference(row) {
  return resolveAppHomePath({
    preferred_audience: row?.preferred_audience,
    preferred_plan: row?.preferred_plan,
    plan_trial_ends_at: row?.plan_trial_ends_at,
  });
}
