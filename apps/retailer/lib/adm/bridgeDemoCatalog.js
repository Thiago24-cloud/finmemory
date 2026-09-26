/** Catálogo demo — espelha o print do FinMemory Bridge (Replit). */
export const BRIDGE_DEMO_INSUMOS = [
  {
    id: 'demo-arroz',
    nome: 'Arroz Longo Fino 5kg',
    ean: '7891234000012',
    unidade: 'kg',
    quantidade_atual: 50,
    custo_medio: 22.8,
    consumer_external_code: null,
    ativo: true,
    is_demo: true,
  },
  {
    id: 'demo-feijao',
    nome: 'Feijão Carioca 1kg',
    ean: '7891234000029',
    unidade: 'kg',
    quantidade_atual: 30,
    custo_medio: 7.2,
    consumer_external_code: null,
    ativo: true,
    is_demo: true,
  },
  {
    id: 'demo-sal',
    nome: 'Sal Refinado 1kg',
    ean: '7891234000036',
    unidade: 'kg',
    quantidade_atual: 15,
    custo_medio: 3.5,
    consumer_external_code: null,
    ativo: true,
    is_demo: true,
  },
  {
    id: 'demo-oleo',
    nome: 'Óleo de Soja 900ml',
    ean: '7891234000043',
    unidade: 'un',
    quantidade_atual: 24,
    custo_medio: 6.9,
    consumer_external_code: null,
    ativo: true,
    is_demo: true,
  },
  {
    id: 'demo-acucar',
    nome: 'Açúcar Cristal 1kg',
    ean: '7891234000050',
    unidade: 'kg',
    quantidade_atual: 40,
    custo_medio: 4.2,
    consumer_external_code: null,
    ativo: true,
    is_demo: true,
  },
  {
    id: 'demo-cafe',
    nome: 'Café Torrado 500g',
    ean: '7891234000067',
    unidade: 'un',
    quantidade_atual: 18,
    custo_medio: 12.5,
    consumer_external_code: null,
    ativo: true,
    is_demo: true,
  },
  {
    id: 'demo-leite',
    nome: 'Leite Integral 1L',
    ean: '7891234000074',
    unidade: 'un',
    quantidade_atual: 36,
    custo_medio: 4.8,
    consumer_external_code: null,
    ativo: true,
    is_demo: true,
  },
  {
    id: 'demo-macarrao',
    nome: 'Macarrão Espaguete 500g',
    ean: '7891234000081',
    unidade: 'un',
    quantidade_atual: 45,
    custo_medio: 3.9,
    consumer_external_code: null,
    ativo: true,
    is_demo: true,
  },
  {
    id: 'demo-farinha',
    nome: 'Farinha de Trigo 1kg',
    ean: '7891234000098',
    unidade: 'kg',
    quantidade_atual: 22,
    custo_medio: 5.1,
    consumer_external_code: null,
    ativo: true,
    is_demo: true,
  },
];

/** Lojas demo quando o mapa ainda não tem ofertas reais para o produto. */
const DEMO_STORE_TEMPLATES = [
  { nome_loja: 'Atacadão', distance_km: 1.1, price_factor: 0.96 },
  { nome_loja: 'Assaí Atacadista', distance_km: 2.4, price_factor: 0.99 },
  { nome_loja: 'Supermercado Bom Preço', distance_km: 0.7, price_factor: 1.03 },
  { nome_loja: 'Mercado Central', distance_km: 3.2, price_factor: 0.94 },
];

function offsetCoords(lat, lng, kmNorth, kmEast) {
  const dLat = kmNorth / 111;
  const dLng = kmEast / (111 * Math.cos((lat * Math.PI) / 180));
  return { lat: lat + dLat, lng: lng + dLng };
}

/**
 * Ofertas simuladas próximas à geolocalização (fallback demo).
 * @param {{ nome: string, custo_medio?: number }} insumo
 * @param {number} lat
 * @param {number} lng
 */
export function getDemoPurchaseStoresForInsumo(insumo, lat, lng) {
  const base = Number(insumo.custo_medio) > 0 ? Number(insumo.custo_medio) : 9.9;
  return DEMO_STORE_TEMPLATES.map((tpl, i) => {
    const coords = offsetCoords(lat, lng, tpl.distance_km * 0.6, tpl.distance_km * 0.4 * (i % 2 ? 1 : -1));
    const preco = Number((base * tpl.price_factor).toFixed(2));
    return {
      nome_loja: tpl.nome_loja,
      produto_nome: insumo.nome,
      preco,
      lat: coords.lat,
      lng: coords.lng,
      distance_km: tpl.distance_km,
      origem: 'demo',
    };
  }).sort((a, b) => a.distance_km - b.distance_km);
}

/**
 * Grava insumos demo na loja (ignora EAN já existente).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} lojaId
 */
export async function seedBridgeDemoInsumos(supabase, lojaId) {
  const nowIso = new Date().toISOString();
  const created = [];

  for (const item of BRIDGE_DEMO_INSUMOS) {
    const { data: existing } = await supabase
      .from('insumos_loja')
      .select('id')
      .eq('loja_id', lojaId)
      .eq('ean', item.ean)
      .maybeSingle();

    if (existing?.id) {
      created.push(existing.id);
      continue;
    }

    const { data: row, error } = await supabase
      .from('insumos_loja')
      .insert({
        loja_id: lojaId,
        nome: item.nome,
        ean: item.ean,
        unidade: item.unidade,
        quantidade_atual: item.quantidade_atual,
        custo_medio: item.custo_medio,
        estoque_minimo: 0,
        recorrente: true,
        ativo: true,
        status_revisao: 'aprovado',
        updated_at: nowIso,
      })
      .select('id')
      .single();

    if (error) throw new Error(error.message);
    if (row?.id) created.push(row.id);
  }

  return { created_count: created.length, ids: created };
}
