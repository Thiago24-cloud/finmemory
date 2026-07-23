import { minutesUntilEta } from './computePedidoEta';
import { normalizeStatusToEnglish, statusLabelPt } from './pedidoStatus';

/**
 * @param {Record<string, unknown>} row
 * @param {Record<string, unknown>[] | null | undefined} itens
 */
export function mapPedidoRowToApi(row, itens) {
  const eta = row.eta_previsto_em;
  const statusEn = normalizeStatusToEnglish(row.status);
  return {
    id: row.id,
    restaurant_id: row.loja_id,
    loja_id: row.loja_id,
    consumer_id: row.cliente_user_id || null,
    cliente_user_id: row.cliente_user_id || null,
    customer_name: row.customer_name || null,
    customer_phone: row.customer_phone || null,
    order_type: row.order_type || (row.origem === 'delivery' ? 'delivery' : 'pickup'),
    order_source: row.order_source || null,
    pickup_code: row.pickup_code || null,
    status: row.status,
    status_en: statusEn,
    status_label: statusLabelPt(row.status),
    payment_status: row.payment_status || 'paid',
    forma_pagamento: row.forma_pagamento || null,
    pagamentos: Array.isArray(row.pagamentos_json) ? row.pagamentos_json : null,
    total: Number(row.total),
    total_amount: Number(row.total),
    notes: row.observacao || null,
    observacao: row.observacao || null,
    tempo_preparo_minutos: row.tempo_preparo_minutos,
    eta_previsto_em: eta,
    eta_minutos_restantes: minutesUntilEta(eta),
    criado_em: row.criado_em,
    created_at: row.criado_em,
    updated_at: row.updated_at || null,
    preparo_iniciado_em: row.preparo_iniciado_em || null,
    pronto_em: row.pronto_em || null,
    concluido_em: row.concluido_em || null,
    mesa_id: row.mesa_id || null,
    mesa_numero: row.mesa_numero ?? null,
    origem: row.origem || 'balcao',
    restaurant_customer_id: row.restaurant_customer_id || null,
    itens: (itens || []).map((i) => ({
      id: i.id,
      product_id: i.produto_loja_id,
      produto_loja_id: i.produto_loja_id,
      product_name_snapshot: i.nome,
      nome: i.nome,
      unit_price_snapshot: Number(i.preco_unitario),
      preco_unitario: Number(i.preco_unitario),
      quantity: i.quantidade,
      quantidade: i.quantidade,
      total_price:
        i.total_price != null
          ? Number(i.total_price)
          : Number(i.preco_unitario) * Number(i.quantidade),
      subtotal:
        i.total_price != null
          ? Number(i.total_price)
          : Number(i.preco_unitario) * Number(i.quantidade),
    })),
  };
}

