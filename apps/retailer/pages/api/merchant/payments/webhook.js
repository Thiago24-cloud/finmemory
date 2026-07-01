import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import {
  normalizeWebhookItems,
  processTerminalPayment,
} from '../../../../lib/merchant/vendas/processTerminalPayment';
import { requireWebhookApiKey } from '../../../../lib/merchant/vendas/requireWebhookApiKey';

/**
 * POST /api/merchant/payments/webhook
 * Confirmação de pagamento da maquininha (payload normalizado pelo app Android).
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!requireWebhookApiKey(req, res)) return;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Serviço indisponível' });
  }

  const body = req.body || {};
  const lojaId = body.loja_id || body.lojaId;
  if (!lojaId) {
    return res.status(400).json({ error: 'loja_id obrigatório no payload' });
  }

  const itemsResult = normalizeWebhookItems(body.items);
  if (itemsResult.error) {
    return res.status(400).json({ error: itemsResult.error });
  }

  const result = await processTerminalPayment(supabase, {
    lojaId,
    externalRef: body.external_ref || body.externalRef,
    idempotencyKey: null,
    terminal: body.terminal,
    bandeira: body.bandeira,
    valorTotal: body.valor_total ?? body.valorTotal,
    metodo: body.metodo,
    status: body.status,
    rawPayload: body.raw ?? body,
    vendidoEm: null,
    items: itemsResult.items,
  });

  return res.status(result.status).json(result.body);
}
