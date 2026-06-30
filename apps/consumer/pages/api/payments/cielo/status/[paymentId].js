import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { getCieloService } from '@finmemory/shared/payments/cielo';
import { getCieloPaymentDiagnostics } from '../../../../lib/cielo/cieloDiagnostics';
import { updateCieloPaymentStatus } from '../../../../lib/cielo/persistCieloPayment';
import { getCieloStatusLabel } from '@finmemory/shared/payments/cielo';

/**
 * GET /api/payments/cielo/status/[paymentId]
 * Consulta status na Cielo (API Query) e atualiza auditoria.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const diag = getCieloPaymentDiagnostics();
  if (!diag.ok) {
    return res.status(503).json({
      error: 'Gateway Cielo indisponível.',
      issues: diag.issues,
    });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ error: 'auth_required' });
  }

  const paymentId = String(req.query.paymentId || '').trim();
  if (!paymentId) {
    return res.status(400).json({ error: 'paymentId obrigatório.' });
  }

  const cielo = getCieloService();
  if (!cielo) {
    return res.status(503).json({ error: 'Serviço Cielo não inicializado.' });
  }

  try {
    const statusResult = await cielo.getPaymentStatus(paymentId);
    const supabase = getSupabaseAdmin();
    if (supabase) {
      await updateCieloPaymentStatus(supabase, paymentId, statusResult);
    }

    return res.status(200).json({
      ok: true,
      paymentId: statusResult.paymentId,
      status: statusResult.status,
      statusLabel: getCieloStatusLabel(statusResult.status),
      returnCode: statusResult.returnCode,
      returnMessage: statusResult.returnMessage,
      finmemoryState: statusResult.finmemoryState,
      isConfirmed: statusResult.isConfirmed,
    });
  } catch (error) {
    const httpStatus = error?.httpStatus || 502;
    return res.status(httpStatus >= 400 && httpStatus < 600 ? httpStatus : 502).json({
      error: error?.message || 'Falha ao consultar pagamento.',
    });
  }
}
