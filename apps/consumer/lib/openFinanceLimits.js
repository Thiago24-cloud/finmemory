import { getPlan } from './stripePlanPrice';

/** Bancos (itens Pluggy / linhas em bank_connections) no plano Grátis — sem prazo. */
export const FREE_OPEN_FINANCE_BANK_LIMIT = 1;

/**
 * @param {string | null | undefined} plan
 * @returns {number}
 */
export function getOpenFinanceBankLimit(plan) {
  const slug = String(plan || 'free').toLowerCase();
  if (slug === 'familia' || slug === 'família') {
    return getPlan('família').totalConnections || 15;
  }
  if (slug === 'free') {
    return FREE_OPEN_FINANCE_BANK_LIMIT;
  }
  const row = getPlan(slug === 'enterprise' ? 'enterprise' : slug === 'pro' ? 'pro' : slug);
  const per = Number(row.openFinancePerMember) || 3;
  const members = Number(row.members) || 1;
  return per * members;
}

/**
 * @param {string | null | undefined} plan
 * @param {number} connectionCount — linhas em bank_connections do utilizador
 * @param {{ reconnecting?: boolean }} [opts]
 */
export function canAddBankConnection(plan, connectionCount, opts = {}) {
  if (opts.reconnecting) return true;
  const limit = getOpenFinanceBankLimit(plan);
  const count = Math.max(0, Number(connectionCount) || 0);
  return count < limit;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 */
export async function countBankConnections(supabase, userId) {
  const { count, error } = await supabase
    .from('bank_connections')
    .select('item_id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) throw error;
  return count ?? 0;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @param {string} itemId
 */
export async function hasBankConnectionItem(supabase, userId, itemId) {
  const { data, error } = await supabase
    .from('bank_connections')
    .select('item_id')
    .eq('user_id', userId)
    .eq('item_id', itemId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data?.item_id);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 */
export async function getUserPlanSlug(supabase, userId) {
  const { data, error } = await supabase
    .from('users')
    .select('plano, plano_ativo')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  const plano = String(data?.plano || 'free').toLowerCase();
  if (!data?.plano_ativo && plano !== 'free') return 'free';
  return plano === 'família' ? 'familia' : plano;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @param {string} [itemId] — se for reconexão do mesmo item, não conta como novo banco
 */
export async function assertCanAddBankConnection(supabase, userId, itemId) {
  const plan = await getUserPlanSlug(supabase, userId);
  const count = await countBankConnections(supabase, userId);
  const reconnecting = itemId ? await hasBankConnectionItem(supabase, userId, itemId) : false;

  if (canAddBankConnection(plan, count, { reconnecting })) {
    return {
      ok: true,
      plan,
      limit: getOpenFinanceBankLimit(plan),
      count,
      reconnecting,
    };
  }

  const limit = getOpenFinanceBankLimit(plan);
  const err = new Error(
    plan === 'free'
      ? `No plano Grátis pode ligar ${limit} banco por tempo ilimitado. Para mais bancos, assine Pro, Família ou Enterprise.`
      : `Limite de ${limit} banco(s) no seu plano. Remova uma conexão antiga ou faça upgrade.`
  );
  err.code = 'open_finance_bank_limit';
  err.plan = plan;
  err.limit = limit;
  err.count = count;
  throw err;
}
