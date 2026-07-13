/**
 * Projeta lat/lng em coordenadas % para o mapa estilo Skip (SVG).
 * @param {Array<{ lat?: number|null, lng?: number|null, nome_loja?: string, storeName?: string, preco?: number, price?: number, [key: string]: unknown }>} stores
 * @param {{ lat?: number|null, lng?: number|null }} [center]
 */
export function projectStoresToMap(stores, center) {
  const rows = (stores || []).filter(
    (s) => Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lng))
  );
  if (rows.length === 0) {
    return (stores || []).map((s, i) => ({
      ...s,
      name: s.nome_loja || s.storeName || `Mercado ${i + 1}`,
      price: Number(s.preco ?? s.price) || 0,
      x: 20 + (i % 3) * 25,
      y: 25 + Math.floor(i / 3) * 22,
      color: pickStoreColor(s.nome_loja || s.storeName, i),
    }));
  }

  const centerLat = Number(center?.lat) || rows.reduce((s, r) => s + Number(r.lat), 0) / rows.length;
  const centerLng = Number(center?.lng) || rows.reduce((s, r) => s + Number(r.lng), 0) / rows.length;

  const projected = rows.map((row) => {
    const lat = Number(row.lat);
    const lng = Number(row.lng);
    const dLat = (lat - centerLat) * 111000;
    const dLng = (lng - centerLng) * 111000 * Math.cos((centerLat * Math.PI) / 180);
    return { row, dLat, dLng };
  });

  const maxAbs = Math.max(
    800,
    ...projected.map((p) => Math.max(Math.abs(p.dLat), Math.abs(p.dLng)))
  );

  return projected.map((p, i) => {
    const name = p.row.nome_loja || p.row.storeName || `Mercado ${i + 1}`;
    const x = 50 + (p.dLng / maxAbs) * 38;
    const y = 50 - (p.dLat / maxAbs) * 38;
    return {
      ...p.row,
      name,
      price: Number(p.row.preco ?? p.row.price) || 0,
      x: Math.min(92, Math.max(8, x)),
      y: Math.min(88, Math.max(12, y)),
      color: pickStoreColor(name, i),
      lat: Number(p.row.lat),
      lng: Number(p.row.lng),
    };
  });
}

const CHAIN_COLORS = {
  dia: '#e30613',
  atacadao: '#f7941d',
  atacadão: '#f7941d',
  sonda: '#0066b3',
  mambo: '#7c3aed',
  assai: '#00a651',
  carrefour: '#004e9f',
  extra: '#e30613',
};

function pickStoreColor(name, index) {
  const key = String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  for (const [chain, color] of Object.entries(CHAIN_COLORS)) {
    if (key.includes(chain)) return color;
  }
  const palette = ['#2563eb', '#16a34a', '#dc2626', '#ca8a04', '#0891b2', '#9333ea'];
  return palette[index % palette.length];
}
