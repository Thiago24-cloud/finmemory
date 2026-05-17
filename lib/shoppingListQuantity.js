/** Atalhos de volume para modo varejista na lista de compras. */
export const RETAILER_QUICK_QUANTITIES = [10, 25, 50, 100];

export const RETAILER_PACK_UNITS = [
  { value: 'un', label: 'Un' },
  { value: 'cx', label: 'Caixa' },
  { value: 'pct', label: 'Pacote' },
  { value: 'dz', label: 'Dúzia' },
  { value: 'kg', label: 'Kg' },
];

export const CONSUMER_QUANTITY_PRESETS = [1, 2, 3, 4, 5, 6];

/**
 * @param {number} raw
 * @param {boolean} isRetailer
 */
export function clampShoppingQuantity(raw, isRetailer) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 1;
  const max = isRetailer ? 99999 : 99;
  return Math.min(max, Math.round(n));
}
