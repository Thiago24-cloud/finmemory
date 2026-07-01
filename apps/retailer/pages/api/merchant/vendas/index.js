import { requireMerchantApi } from '../../../../lib/merchant/requireMerchantApi';
import { mapVendaRow } from '../../../../lib/merchant/vendas/mapVendaRow';
import {
  androidSaleToPaymentParams,
  processTerminalPayment,
} from '../../../../lib/merchant/vendas/processTerminalPayment';

/** GET lista · POST venda (app Android) */
export default async function handler(req, res) {
  const ctx = await requireMerchantApi(req, res);
  if (!ctx) return;

  const lojaId = ctx.store.id;

  if (req.method === 'GET') {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);

    const { data: vendas, error } = await ctx.supabase
      .from('vendas_terminal')
      .select('*')
      .eq('loja_id', lojaId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[vendas GET]', error);
      return res.status(500).json({ error: 'Erro ao listar vendas' });
    }

    const ids = (vendas || []).map((v) => v.id);
    let items = [];
    if (ids.length > 0) {
      const { data: itemRows, error: itemsErr } = await ctx.supabase
        .from('venda_terminal_itens')
        .select('*')
        .in('venda_id', ids);
      if (itemsErr) {
        console.error('[vendas items]', itemsErr);
        return res.status(500).json({ error: 'Erro ao carregar itens' });
      }
      items = itemRows || [];
    }

    const byVenda = new Map();
    for (const item of items) {
      const list = byVenda.get(item.venda_id) || [];
      list.push(item);
      byVenda.set(item.venda_id, list);
    }

    return res.status(200).json(
      (vendas || []).map((v) => mapVendaRow(v, byVenda.get(v.id) || []))
    );
  }

  if (req.method === 'POST') {
    const converted = androidSaleToPaymentParams(lojaId, req.body || {});
    if (converted.error) {
      return res.status(converted.status || 400).json({ error: converted.error });
    }

    const idempotencyHeader = req.headers['x-idempotency-key'];
    if (idempotencyHeader && !converted.params.idempotencyKey) {
      converted.params.idempotencyKey = String(idempotencyHeader);
    }

    const result = await processTerminalPayment(ctx.supabase, converted.params);
    if (!result.ok) {
      return res.status(result.status).json(result.body);
    }

    return res.status(result.status).json({
      vendaId: result.body.venda_id,
      estoqueAtualizado: result.body.stock_updated,
      ...result.body,
    });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
