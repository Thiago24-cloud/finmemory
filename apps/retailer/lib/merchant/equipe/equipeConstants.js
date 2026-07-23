/** Constantes da equipe — seguro para client e server. */

export const EQUIPE_PAPEIS = ['garcom', 'cozinha', 'caixa'];

export const EQUIPE_PAPEL_LABEL = {
  garcom: 'Garçom',
  cozinha: 'Cozinha',
  caixa: 'Caixa',
};

/** Telas permitidas por papel (ids do skip nav / panelTab). */
export const EQUIPE_TABS_BY_PAPEL = {
  garcom: ['garcom', 'mesas'],
  cozinha: ['cozinha'],
  caixa: ['caixa', 'historico'],
};

export function normalizePapel(raw) {
  const p = String(raw || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  if (p === 'garcom' || p === 'waiter') return 'garcom';
  if (p === 'cozinha' || p === 'kitchen' || p === 'chef') return 'cozinha';
  if (p === 'caixa' || p === 'cashier') return 'caixa';
  return EQUIPE_PAPEIS.includes(p) ? p : null;
}
