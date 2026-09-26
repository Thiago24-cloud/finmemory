/**
 * Detecta quedas de preço no mapa vs. baseline (custo médio / último preço visto).
 */
import { sendOneSignalToUser } from '../../push/oneSignalSend.js';

function normalizeName(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ userId: string, lojaId: string, lat?: number, lng?: number, radiusKm?: number, notify?: boolean }} opts
 */
export async function runPriceDropAlertsForStore(supabase, opts) {
  const { userId, lojaId, lat, lng, radiusKm = 12, notify = false } = opts;
  if (!userId || !lojaId) return { ok: false, error: 'missing_ids', alerts: [] };

  const { data: insumos, error } = await supabase
    .from('insumos_loja')
    .select('id, nome, custo_medio, alerta_preco, na_cesta, ativo')
    .eq('loja_id', lojaId)
    .eq('ativo', true)
    .or('alerta_preco.eq.true,na_cesta.eq.true')
    .limit(80);

  if (error) {
    // coluna alerta_preco pode não existir ainda
    if (/alerta_preco|column/i.test(error.message || '')) {
      const { data: fallback } = await supabase
        .from('insumos_loja')
        .select('id, nome, custo_medio, na_cesta, ativo')
        .eq('loja_id', lojaId)
        .eq('ativo', true)
        .eq('na_cesta', true)
        .limit(80);
      return runAgainstInsumos(supabase, {
        userId,
        insumos: (fallback || []).map((i) => ({ ...i, alerta_preco: true })),
        lat,
        lng,
        radiusKm,
        notify,
      });
    }
    return { ok: false, error: error.message, alerts: [] };
  }

  return runAgainstInsumos(supabase, {
    userId,
    insumos: insumos || [],
    lat,
    lng,
    radiusKm,
    notify,
  });
}

async function runAgainstInsumos(supabase, { userId, insumos, lat, lng, radiusKm, notify }) {
  const alerts = [];
  const since = new Date(Date.now() - 14 * 86400000).toISOString();

  for (const ins of insumos || []) {
    const nome = String(ins.nome || '').trim();
    if (!nome || nome.length < 3) continue;
    const token = normalizeName(nome).split(' ')[0];
    if (token.length < 3) continue;

    const { data: pts } = await supabase
      .from('price_points')
      .select('price, store_name, product_name, created_at, lat, lng, expires_at')
      .ilike('product_name', `%${token}%`)
      .ilike('category', '%promo%')
      .gte('created_at', since)
      .order('price', { ascending: true })
      .limit(40);

    const candidates = (pts || []).filter((p) => {
      if (/\[sim-cesta\]/i.test(p.product_name || '')) return false;
      if (p.expires_at) {
        const exp = new Date(p.expires_at);
        if (Number.isFinite(exp.getTime()) && exp < new Date()) return false;
      }
      if (lat == null || lng == null || p.lat == null || p.lng == null) return true;
      const dLat = (Number(p.lat) - Number(lat)) * 111;
      const dLng = (Number(p.lng) - Number(lng)) * 111 * Math.cos((Number(lat) * Math.PI) / 180);
      return Math.sqrt(dLat * dLat + dLng * dLng) <= radiusKm;
    });
    if (!candidates.length) continue;

    const best = candidates[0];
    const mapPrice = Number(best.price);
    const baseline = Number(ins.custo_medio);
    if (!Number.isFinite(mapPrice) || mapPrice <= 0) continue;
    if (!Number.isFinite(baseline) || baseline <= 0) continue;
    const dropPct = ((baseline - mapPrice) / baseline) * 100;
    if (dropPct < 8) continue;

    const alert = {
      insumoId: ins.id,
      nome,
      baseline,
      mapPrice,
      dropPct: Number(dropPct.toFixed(1)),
      storeName: best.store_name,
      productName: best.product_name,
      whatsappText: `${nome} caiu ${dropPct.toFixed(0)}% no ${best.store_name}: R$ ${mapPrice
        .toFixed(2)
        .replace('.', ',')} (você pagava ~R$ ${baseline.toFixed(2).replace('.', ',')}). FinMemory Parceiros.`,
    };
    alerts.push(alert);

    if (notify) {
      await sendOneSignalToUser(userId, {
        title: `${nome}: -${alert.dropPct}% perto de você`,
        body: `${best.store_name} · R$ ${mapPrice.toFixed(2).replace('.', ',')} (antes ~R$ ${baseline
          .toFixed(2)
          .replace('.', ',')})`,
        url: `${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://parceiros.finmemory.com.br'}/parceiros/painel`,
      });
    }
  }

  return { ok: true, alerts, checked: (insumos || []).length };
}

export function whatsappShareUrl(text) {
  return `https://wa.me/?text=${encodeURIComponent(String(text || ''))}`;
}
