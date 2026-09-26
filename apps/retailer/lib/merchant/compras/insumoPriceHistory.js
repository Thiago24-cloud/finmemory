/**
 * Histórico de preço de um insumo: custo próprio (movimentações) + mapa (price_points).
 */

function normalizeName(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ lojaId: string, insumoId: string, nome?: string, days?: number }} opts
 */
export async function fetchInsumoPriceHistory(supabase, { lojaId, insumoId, nome, days = 90 }) {
  const since = new Date(Date.now() - Math.max(7, Math.min(180, days)) * 86400000).toISOString();

  const paid = [];
  const { data: movs } = await supabase
    .from('insumo_movimentacoes')
    .select('created_at, preco_unitario, tipo, nota_entrada_id')
    .eq('loja_id', lojaId)
    .eq('insumo_id', insumoId)
    .not('preco_unitario', 'is', null)
    .gte('created_at', since)
    .order('created_at', { ascending: true })
    .limit(200);

  for (const m of movs || []) {
    const price = Number(m.preco_unitario);
    if (!Number.isFinite(price) || price <= 0) continue;
    paid.push({
      at: m.created_at,
      price,
      source: 'nota',
      label: 'Você pagou',
    });
  }

  const mapPoints = [];
  const needle = normalizeName(nome).slice(0, 40);
  if (needle.length >= 3) {
    const { data: pts } = await supabase
      .from('price_points')
      .select('created_at, price, store_name, product_name')
      .ilike('product_name', `%${needle.split(' ')[0]}%`)
      .ilike('category', '%promo%')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(120);

    const seen = new Set();
    for (const p of pts || []) {
      const pn = normalizeName(p.product_name);
      if (!pn.includes(needle.slice(0, Math.min(12, needle.length))) && !needle.includes(pn.slice(0, 8))) {
        continue;
      }
      if (/\[sim-cesta\]/i.test(p.product_name || '')) continue;
      const price = Number(p.price);
      if (!Number.isFinite(price) || price <= 0) continue;
      const day = String(p.created_at).slice(0, 10);
      const key = `${day}|${p.store_name}|${price.toFixed(2)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      mapPoints.push({
        at: p.created_at,
        price,
        source: 'mapa',
        label: p.store_name || 'Mapa',
        storeName: p.store_name,
      });
    }
    mapPoints.sort((a, b) => new Date(a.at) - new Date(b.at));
  }

  const lastPaid = paid.length ? paid[paid.length - 1].price : null;
  const latestMap = mapPoints.length ? mapPoints[mapPoints.length - 1].price : null;
  let dropPct = null;
  if (Number.isFinite(lastPaid) && Number.isFinite(latestMap) && lastPaid > 0) {
    dropPct = Number((((lastPaid - latestMap) / lastPaid) * 100).toFixed(1));
  }

  return {
    paid,
    map: mapPoints.slice(-60),
    summary: {
      lastPaid,
      latestMap,
      dropPct,
      advice:
        dropPct != null && dropPct >= 8
          ? `Hoje está ~${dropPct}% abaixo do que você pagou — vale comprar.`
          : dropPct != null && dropPct <= -8
            ? `Mapa está ~${Math.abs(dropPct)}% acima do seu custo — espere se puder.`
            : lastPaid != null && latestMap != null
              ? 'Preço perto do que você costuma pagar.'
              : 'Ainda sem histórico suficiente.',
    },
  };
}
