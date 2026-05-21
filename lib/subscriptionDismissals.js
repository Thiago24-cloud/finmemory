/**
 * Assinaturas detectadas ignoradas pelo utilizador (não reaparecem na análise).
 */

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @returns {Promise<Set<string>>}
 */
export async function getDismissedSubscriptionIds(supabase, userId) {
  const { data, error } = await supabase
    .from('subscription_detection_dismissals')
    .select('detection_id')
    .eq('user_id', userId);

  if (error) {
    if (/does not exist|relation.*not found/i.test(error.message || '')) {
      return new Set();
    }
    throw error;
  }

  return new Set((data || []).map((r) => String(r.detection_id)).filter(Boolean));
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @param {string[]} detectionIds
 */
export async function dismissSubscriptionDetections(supabase, userId, detectionIds) {
  const ids = [...new Set((detectionIds || []).map((id) => String(id).trim()).filter(Boolean))];
  if (!ids.length) return { dismissed: 0 };

  const rows = ids.map((detection_id) => ({ user_id: userId, detection_id }));
  const { error } = await supabase
    .from('subscription_detection_dismissals')
    .upsert(rows, { onConflict: 'user_id,detection_id', ignoreDuplicates: true });

  if (error) {
    if (/does not exist|relation.*not found/i.test(error.message || '')) {
      const err = new Error('Tabela de ignorados não configurada. Execute a migration no Supabase.');
      err.code = 'MISSING_TABLE';
      throw err;
    }
    throw error;
  }

  return { dismissed: ids.length };
}
