export function mapMesaRowToApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    loja_id: row.loja_id,
    numero: row.numero,
    capacidade: row.capacidade ?? 4,
    status: row.status || 'livre',
    observacao: row.observacao || '',
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function buildMesaQrUrl({ storeId, mesaNumero, baseUrl }) {
  const base = String(baseUrl || '').replace(/\/$/, '');
  const params = new URLSearchParams({
    loja: storeId,
    mesa: String(mesaNumero),
  });
  return `${base}/parceiros/pedir?${params.toString()}`;
}
