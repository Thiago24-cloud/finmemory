export const PEDIDO_STATUS = {
  PENDENTE: 'pendente',
  PREPARANDO: 'preparando',
  PRONTO: 'pronto',
  CONCLUIDO: 'concluido',
  CANCELADO: 'cancelado',
};

/** @param {string} status */
export function isValidPedidoStatus(status) {
  return Object.values(PEDIDO_STATUS).includes(status);
}

/** Transições permitidas no painel da loja. */
const TRANSITIONS = {
  pendente: ['preparando', 'cancelado'],
  preparando: ['pronto', 'cancelado'],
  pronto: ['concluido', 'cancelado'],
  concluido: [],
  cancelado: [],
};

/**
 * @param {string} from
 * @param {string} to
 */
export function canTransitionPedidoStatus(from, to) {
  const allowed = TRANSITIONS[from];
  return Array.isArray(allowed) && allowed.includes(to);
}
