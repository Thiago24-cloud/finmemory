/**
 * Persiste transação Cielo para auditoria financeira (service role).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{
 *   userId: string,
 *   merchantOrderId: string,
 *   result: import('@finmemory/shared/payments/cielo').CieloCreatePaymentResult,
 *   paymentMethod: 'pix' | 'credit_card',
 *   description: string,
 *   environment: string,
 * }} input
 */
export async function persistCieloPayment(supabase, input) {
  if (!supabase) return { ok: false, error: 'supabase_unavailable' };

  const row = {
    user_id: input.userId,
    merchant_order_id: input.merchantOrderId,
    cielo_payment_id: input.result.paymentId,
    amount_cents: input.result.amountCents,
    description: input.description,
    payment_method: input.paymentMethod,
    cielo_status: input.result.status,
    return_code: input.result.returnCode,
    return_message: input.result.returnMessage,
    finmemory_status: input.result.finmemoryState,
    environment: input.environment,
    raw_response: input.result.raw,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('cielo_payments')
    .insert(row)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[cielo] persist:', error.message);
    return { ok: false, error: error.message };
  }

  return { ok: true, id: data?.id || null };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} paymentId
 * @param {import('@finmemory/shared/payments/cielo').CieloPaymentStatusResult} statusResult
 */
export async function updateCieloPaymentStatus(supabase, paymentId, statusResult) {
  if (!supabase || !paymentId) return { ok: false };

  const { error } = await supabase
    .from('cielo_payments')
    .update({
      cielo_status: statusResult.status,
      return_code: statusResult.returnCode,
      return_message: statusResult.returnMessage,
      finmemory_status: statusResult.finmemoryState,
      raw_response: statusResult.raw,
      updated_at: new Date().toISOString(),
    })
    .eq('cielo_payment_id', paymentId);

  if (error) {
    console.warn('[cielo] update status:', error.message);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
