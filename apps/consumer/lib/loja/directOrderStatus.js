/**
 * Status helpers (consumer) — espelho leve do retailer.
 */

export const DIRECT_ORDER_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  PREPARING: 'preparing',
  READY_FOR_PICKUP: 'ready_for_pickup',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  DELIVERED: 'delivered',
  CANCELED: 'canceled',
};

const PT_TO_EN = {
  pendente: 'pending',
  preparando: 'preparing',
  pronto: 'ready_for_pickup',
  concluido: 'delivered',
  cancelado: 'canceled',
};

export function normalizeStatusToEnglish(status) {
  const s = String(status || '');
  if (PT_TO_EN[s]) return PT_TO_EN[s];
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
