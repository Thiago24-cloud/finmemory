import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { resolvePublicUserId } from '../../../../lib/resolvePublicUserId';
import {
  buildCieloMerchantOrderId,
  getCieloConfigFromEnv,
  getCieloService,
} from '@finmemory/shared/payments/cielo';
import { getCieloPaymentDiagnostics } from '../../../../lib/cielo/cieloDiagnostics';
import { persistCieloPayment } from '../../../../lib/cielo/persistCieloPayment';

function parseJsonBody(req) {
  if (typeof req.body === 'object' && req.body !== null) return req.body;
  if (typeof req.body === 'string' && req.body.trim()) {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return {};
}

function parseAmountCents(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

/**
 * POST /api/payments/cielo/create
 *
 * Body JSON:
 * {
 *   "amountCents": 1990,
 *   "description": "FinMemory Pro — 1 mês",
 *   "paymentMethod": "pix" | "credit_card",
 *   "creditCard": { ... } // obrigatório se credit_card
 * }
 *
 * O userId vem da sessão (nunca do body).
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const diag = getCieloPaymentDiagnostics();
  if (!diag.ok) {
    return res.status(503).json({
      error: 'Gateway Cielo indisponível. Configure CIELO_MERCHANT_ID e CIELO_MERCHANT_KEY.',
      issues: diag.issues,
    });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({
      error: 'Faça login para concluir o pagamento.',
      code: 'auth_required',
    });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(503).json({ error: 'Banco de dados indisponível.' });
  }

  const userId = await resolvePublicUserId(session, supabase);
  if (!userId) {
    return res.status(403).json({ error: 'Conta de usuário não encontrada.' });
  }

  const body = parseJsonBody(req);
  const amountCents = parseAmountCents(body.amountCents);
  const description = String(body.description || '').trim();
  const paymentMethod = body.paymentMethod === 'credit_card' ? 'credit_card' : 'pix';

  if (!amountCents) {
    return res.status(400).json({ error: 'amountCents inválido (inteiro positivo em centavos).' });
  }
  if (!description || description.length < 3) {
    return res.status(400).json({ error: 'description é obrigatória (mín. 3 caracteres).' });
  }

  const cielo = getCieloService();
  const config = getCieloConfigFromEnv();
  if (!cielo || !config) {
    return res.status(503).json({ error: 'Serviço Cielo não inicializado.' });
  }

  const merchantOrderId = buildCieloMerchantOrderId('FM', userId);
  const customerName =
    String(session.user.name || session.user.email || 'Cliente FinMemory').trim();

  try {
    const result = await cielo.createPayment({
      merchantOrderId,
      amountCents,
      description,
      customerName,
      paymentMethod,
      installments: Number(body.installments) > 0 ? Number(body.installments) : 1,
      creditCard: paymentMethod === 'credit_card' ? body.creditCard : undefined,
    });

    await persistCieloPayment(supabase, {
      userId,
      merchantOrderId,
      result,
      paymentMethod,
      description,
      environment: config.environment,
    });

    return res.status(200).json({
      ok: true,
      gateway: 'cielo',
      environment: config.environment,
      merchantOrderId: result.merchantOrderId,
      paymentId: result.paymentId,
      status: result.status,
      returnCode: result.returnCode,
      returnMessage: result.returnMessage,
      finmemoryState: result.finmemoryState,
      isConfirmed: result.isConfirmed,
      paymentMethod: result.paymentMethod,
      amountCents: result.amountCents,
      pix: result.pix || null,
    });
  } catch (error) {
    const httpStatus = error?.httpStatus || 502;
    console.error('[cielo/create]', error?.message || error);
    return res.status(httpStatus >= 400 && httpStatus < 600 ? httpStatus : 502).json({
      error: error?.message || 'Falha ao processar pagamento na Cielo.',
      details: error?.body || null,
    });
  }
}
