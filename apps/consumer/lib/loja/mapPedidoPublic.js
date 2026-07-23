import { normalizeStatusToEnglish, statusLabelPt } from './directOrderStatus';

export function mapPedidoPublic(row, itens) {
  return {
    id: row.id,
    restaurant_id: row.loja_id,
    consumer_id: row.cliente_user_id || null,
    customer_name: row.customer_name || null,
    customer_phone: row.customer_phone || null,
    order_type: row.order_type || 'pickup',
    order_source: row.order_source || null,
    status: normalizeStatusToEnglish(row.status),
    status_raw: row.status,
    status_label: statusLabelPt(row.status),
    total_amount: Number(row.total),
    notes: row.observacao || null,
    pickup_code: row.pickup_code || null,
    created_at: row.criado_em,
    eta_previsto_em: row.eta_previsto_em || null,
    items: (itens || []).map((i) => ({
      product_id: i.produto_loja_id,
      product_name_snapshot: i.nome,
      unit_price_snapshot: Number(i.preco_unitario),
      quantity: i.quantidade,
      total_price:
        i.total_price != null
          ? Number(i.total_price)
          : Number(i.preco_unitario) * Number(i.quantidade),
    })),
  };
}
