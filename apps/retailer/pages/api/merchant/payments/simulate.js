import { requireMerchantApi } from '../../../../lib/merchant/requireMerchantApi';
import {
  normalizeWebhookItems,
  processTerminalPayment,
} from '../../../../lib/merchant/vendas/processTerminalPayment';

/** POST /api/merchant/payments/simulate — teste sem maquininha (sessão lojista) */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ctx = await requireMerchantApi(req, res);
  if (!ctx) return;

  const body = req.body || {};
  const itemsResult = normalizeWebhookItems(body.items);
  if (itemsResult.error) {
    return res.status(400).json({ error: itemsResult.error });
  }

  const externalRef = `SIM_${Date.now()}`;
  const result = await processTerminalPayment(ctx.supabase, {
    lojaId: ctx.store.id,
    externalRef,
    idempotencyKey: null,
    terminal: body.terminal || 'stone',
    bandeira: body.bandeira,
    valorTotal: body.valor_total ?? body.valorTotal,
    metodo: body.metodo || 'credito',
    status: 'aprovado',
    rawPayload: { _simulated: true },
    vendidoEm: null,
    items: itemsResult.items,
  });

  if (!result.ok) {
    return res.status(result.status).json(result.body);
  }

  return res.status(result.status).json({
    ...result.body,
    simulated: true,
  });
}
