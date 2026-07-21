import { minutesUntilEta } from './computePedidoEta';

/**
 * @param {Record<string, unknown>} row
 * @param {Record<string, unknown>[] | null | undefined} itens
 */
export function mapPedidoRowToApi(row, itens) {
  const eta = row.eta_previsto_em;
  return {
    id: row.id,
    loja_id: row.loja_id,
    cliente_user_id: row.cliente_user_id,
    status: row.status,
    payment_status: row.payment_status || 'paid',
    forma_pagamento: row.forma_pagamento || null,
    pagamentos: Array.isArray(row.pagamentos_json) ? row.pagamentos_json : null,
    total: Number(row.total),
    observacao: row.observacao || null,
    tempo_preparo_minutos: row.tempo_preparo_minutos,
    eta_previsto_em: eta,
    eta_minutos_restantes: minutesUntilEta(eta),
    criado_em: row.criado_em,
    preparo_iniciado_em: row.preparo_iniciado_em || null,
    pronto_em: row.pronto_em || null,
    concluido_em: row.concluido_em || null,
    mesa_id: row.mesa_id || null,
    mesa_numero: row.mesa_numero ?? null,
    origem: row.origem || 'balcao',
    itens: (itens || []).map((i) => ({
      id: i.id,
      produto_loja_id: i.produto_loja_id,
      nome: i.nome,
      preco_unitario: Number(i.preco_unitario),
      quantidade: i.quantidade,
      subtotal: Number(i.preco_unitario) * Number(i.quantidade),
    })),
  };
}
