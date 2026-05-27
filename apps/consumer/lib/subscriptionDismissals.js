/**
 * Assinaturas detectadas ignoradas pelo utilizador (não reaparecem na análise).
 */

function isMissingTableError(error) {
  const msg = String(error?.message || error || '');
  const code = String(error?.code || '');
  return (
    code === '42P01' ||
    /does not exist|relation.*not found|undefined table/i.test(msg)
  );
}

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
    if (isMissingTableError(error)) return new Set();
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

  let inserted = 0;
  for (const detection_id of ids) {
    const { error } = await supabase.from('subscription_detection_dismissals').insert({
      user_id: userId,
      detection_id,
    });

    if (!error) {
      inserted += 1;
      continue;
    }

    if (error.code === '23505') {
      inserted += 1;
      continue;
    }

    if (isMissingTableError(error)) {
      const err = new Error(
        'Tabela subscription_detection_dismissals ausente. Cole no Supabase SQL Editor o ficheiro supabase/migrations/20260521150000_subscription_detection_dismissals.sql'
      );
      err.code = 'MISSING_TABLE';
      throw err;
    }

    if (error.code === '23503') {
      const err = new Error(
        'Conta não encontrada na base de dados. Saia da sessão, entre novamente e tente outra vez.'
      );
      err.code = 'USER_FK';
      throw err;
    }

    throw error;
  }

  return { dismissed: inserted };
}
