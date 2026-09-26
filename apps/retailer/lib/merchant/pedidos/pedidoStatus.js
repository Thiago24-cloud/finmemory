/**
 * Status de pedidos_loja: PT (mesa/cozinha) + EN (pedido direto QR).
 */

export const PEDIDO_STATUS = {
  PENDENTE: 'pendente',
  PREPARANDO: 'preparando',
  PRONTO: 'pronto',
  CONCLUIDO: 'concluido',
  CANCELADO: 'cancelado',
};

export const DIRECT_ORDER_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  PREPARING: 'preparing',
  READY_FOR_PICKUP: 'ready_for_pickup',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  DELIVERED: 'delivered',
  CANCELED: 'canceled',
};

/** PT → EN (API pública / tracking) */
const PT_TO_EN = {
  pendente: 'pending',
  preparando: 'preparing',
  pronto: 'ready_for_pickup',
  concluido: 'delivered',
  cancelado: 'canceled',
};

/** EN → PT (compat cozinha legada se precisar) */
const EN_TO_PT = {
  pending: 'pendente',
  accepted: 'pendente',
  preparing: 'preparando',
  ready_for_pickup: 'pronto',
  out_for_delivery: 'pronto',
  delivered: 'concluido',
  canceled: 'cancelado',
};

const ALL_STATUSES = new Set([
  ...Object.values(PEDIDO_STATUS),
  ...Object.values(DIRECT_ORDER_STATUS),
]);

export function isValidPedidoStatus(status) {
  return ALL_STATUSES.has(String(status || ''));
}

export function normalizeStatusToEnglish(status) {
  const s = String(status || '');
  if (PT_TO_EN[s]) return PT_TO_EN[s];
  if (Object.values(DIRECT_ORDER_STATUS).includes(s)) return s;
  return s || 'pending';
}

export function statusLabelPt(status) {
  const en = normalizeStatusToEnglish(status);
  const labels = {
    pending: 'Pendente',
    accepted: 'Aceito',
    preparing: 'Preparando',
    ready_for_pickup: 'Pronto para retirada',
    out_for_delivery: 'Saiu para entrega',
    delivered: 'Entregue',
    canceled: 'Cancelado',
  };
  return labels[en] || status;
}

/** Transições (EN canônico + aliases PT no mesmo mapa). */
const TRANSITIONS = {
  pendente: ['preparando', 'cancelado', 'accepted', 'preparing', 'canceled'],
  preparando: ['pronto', 'cancelado', 'ready_for_pickup', 'out_for_delivery', 'canceled'],
  pronto: ['concluido', 'cancelado', 'delivered', 'canceled'],
  concluido: [],
  cancelado: [],
  pending: ['accepted', 'preparing', 'canceled', 'preparando', 'cancelado'],
  accepted: ['preparing', 'canceled', 'preparando', 'cancelado'],
  preparing: ['ready_for_pickup', 'out_for_delivery', 'canceled', 'pronto', 'cancelado'],
  ready_for_pickup: ['delivered', 'canceled', 'concluido', 'cancelado'],
  out_for_delivery: ['delivered', 'canceled', 'concluido', 'cancelado'],
  delivered: [],
  canceled: [],
};

export function canTransitionPedidoStatus(from, to) {
  const allowed = TRANSITIONS[from];
  return Array.isArray(allowed) && allowed.includes(to);
}

/** Status “ativos” na cozinha / pedidos diretos. */
export const KITCHEN_ACTIVE_STATUSES = [
  'pendente',
  'preparando',
  'pronto',
  'pending',
  'accepted',
  'preparing',
  'ready_for_pickup',
  'out_for_delivery',
];

export function generatePickupCode() {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `FM-${n}`;
}

export { EN_TO_PT, PT_TO_EN };
