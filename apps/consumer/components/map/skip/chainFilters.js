/**
 * Filtros de rede / raio — espelho do helper do retailer (mesmo ecossistema).
 */

export function inferChainKeyFromStoreName(storeName) {
  const n = String(storeName || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  if (!n) return 'outros';
  if (n.includes('assai') || n.includes('assaí')) return 'assai';
  if (n.includes('atacadao') || n.includes('atacadão')) return 'atacadao';
  if (n.includes('sonda')) return 'sonda';
  if (n.includes('dia ') || n.startsWith('dia') || n.includes('dia —') || n.includes('dia -')) return 'dia';
  if (n.includes('mambo')) return 'mambo';
  if (n.includes('hirota')) return 'hirota';
  if (n.includes('pao de acucar') || n.includes('pão de açúcar') || n.includes('paodeacucar')) {
    return 'paodeacucar';
  }
  if (n.includes('carrefour')) return 'carrefour';
  return 'outros';
}

export const CHAIN_LABELS = {
  assai: 'Assaí',
  atacadao: 'Atacadão',
  sonda: 'Sonda',
  dia: 'DIA',
  mambo: 'Mambo',
  hirota: 'Hirota',
  paodeacucar: 'Pão de Açúcar',
  carrefour: 'Carrefour',
  outros: 'Outros',
};

export function isAtacadoStoreName(storeName) {
  const key = inferChainKeyFromStoreName(storeName);
  return key === 'assai' || key === 'atacadao';
}

export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
