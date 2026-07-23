/**
 * Busca ofertas do mapa por nomes de produto — caminho rápido (ilike + limite).
 * Expande cada item em tokens (ex.: "Arroz integral camil" → arroz, integral, camil)
 * para não perder ofertas cujo nome no banco é só parcialmente igual.
 */

/** Fontes públicas alinhadas ao mapa consumidor. */
export const ADM_MAP_PRICE_SOURCES = [
  'bot_fila_aprovado',
  'admin_manual',
  'community_manual',
  'scraper_dia',
  'scraper_atacadao',
  'scraper_paodeacucar',
  'scraper_sonda',
  'scraper_assai',
  'scraper_mambo',
  'scraper_hirota',
  'scraper_pomardavila',
  'finmemory_agent:dia',
  'finmemory_agent:assai',
  'finmemory_agent:atacadao',
  'finmemory_agent:paodeacucar',
  'finmemory_agent:hirota',
  'finmemory_agent:sonda',
  'finmemory_agent:mambo',
  'finmemory_agent:pomardavila',
  'finmemory_agent:carrefour',
  'finmemory_agent:saojorge',
  'finmemory_agent:lopes',
  'finmemory_agent:agape',
  'finmemory_agent:armazemdocampo',
  'merchant_panel',
];

const STOP = new Set([
  'tipo',
  'pacote',
  'unidade',
  'un',
  'kg',
  'g',
  'ml',
  'l',
  'lt',
  'com',
  'sem',
  'para',
  'cada',
  'leve',
  'pague',
  'pack',
  'pct',
]);

function stripAccents(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function sanitizeIlikeTerm(name) {
  return stripAccents(name)
    .trim()
    .replace(/[%_,]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 80);
}

/**
 * Termos de busca para um item da lista.
 * "Arroz integral camil 1kg" → ["Arroz integral camil 1kg", "arroz", "integral", "camil"]
 */
export function expandSearchTermsForProductName(productName) {
  const raw = String(productName || '').trim();
  if (raw.length < 2) return [];
  const terms = new Set();
  terms.add(raw);

  const norm = sanitizeIlikeTerm(raw).toLowerCase();
  if (norm.length >= 2) terms.add(norm);

  const tokens = norm
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z0-9]/gi, ''))
    .filter((t) => t.length >= 4 && !STOP.has(t) && !/^\d+$/.test(t));

  for (const t of tokens) terms.add(t);

  // Cabeça do produto (1ª palavra significativa) — cobre "arroz …" / "feijao …"
  if (tokens[0]) terms.add(tokens[0]);

  return [...terms].slice(0, 8);
}

function mapPricePointRow(row) {
  const preco = Number(row.price);
  if (!Number.isFinite(preco) || preco <= 0) return null;
  if (row.lat == null || row.lng == null) return null;
  return {
    lugar_id: `pp:${row.id}`,
    nome_loja: String(row.store_name || 'Mercado').trim() || 'Mercado',
    lat: row.lat,
    lng: row.lng,
    produto_nome: String(row.product_name || '').trim(),
    preco,
    origem: 'price_point',
    expires_at: row.expires_at || null,
    created_at: row.created_at || null,
  };
}

function mapPromoRow(row) {
  const preco = Number(row.preco);
  if (!Number.isFinite(preco) || preco <= 0) return null;
  if (row.lat == null || row.lng == null) return null;
  return {
    lugar_id: `promo:${row.id}`,
    nome_loja: String(row.supermercado || 'Mercado').trim() || 'Mercado',
    lat: row.lat,
    lng: row.lng,
    produto_nome: String(row.nome_produto || '').trim(),
    preco,
    origem: 'promo_agent',
    expires_at: row.validade || null,
    created_at: row.created_at || row.atualizado_em || null,
  };
}

function rowKey(row) {
  return `${row.lugar_id}|${String(row.produto_nome || '').toLowerCase()}|${Number(row.preco).toFixed(2)}`;
}

async function fetchByTerm(supabase, term, perNameLimit, promoCutoffIso, today) {
  const clean = sanitizeIlikeTerm(term);
  if (clean.length < 2) return [];
  const pattern = `%${clean}%`;
  const mapped = [];

  const ppQuery = supabase
    .from('price_points')
    .select(
      'id, store_name, product_name, price, lat, lng, created_at, category, source, expires_at'
    )
    .ilike('product_name', pattern)
    .not('lat', 'is', null)
    .not('lng', 'is', null)
    .not('product_name', 'ilike', '%[sim-cesta]%')
    .gte('created_at', promoCutoffIso)
    .in('source', ADM_MAP_PRICE_SOURCES)
    .order('created_at', { ascending: false })
    .limit(perNameLimit);

  const promoQuery = supabase
    .from('promocoes_supermercados')
    .select(
      'id, supermercado, nome_produto, preco, lat, lng, ativo, expira_em, validade, created_at, atualizado_em'
    )
    .ilike('nome_produto', pattern)
    .eq('ativo', true)
    .gt('expira_em', new Date().toISOString())
    .not('lat', 'is', null)
    .not('lng', 'is', null)
    .not('nome_produto', 'ilike', '%[sim-cesta]%')
    .order('atualizado_em', { ascending: false })
    .limit(Math.min(40, perNameLimit));

  const [ppRes, promoRes] = await Promise.all([ppQuery, promoQuery]);

  for (const row of ppRes.data || []) {
    if (row.expires_at && String(row.expires_at).slice(0, 10) < today) continue;
    const m = mapPricePointRow(row);
    if (m) mapped.push(m);
  }
  for (const row of promoRes.data || []) {
    const m = mapPromoRow(row);
    if (m) mapped.push(m);
  }
  return mapped;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string[]} productNames
 * @param {{ perNameLimit?: number, concurrency?: number }} [opts]
 */
export async function fetchMapOffersByProductNames(supabase, productNames, opts = {}) {
  const names = [...new Set(
    (productNames || [])
      .map((n) => String(n || '').trim())
      .filter((n) => n.length >= 2)
  )].slice(0, 24);

  if (!names.length) return [];

  const perNameLimit = Math.min(80, Math.max(20, Number(opts.perNameLimit) || 50));
  const concurrency = Math.min(6, Math.max(2, Number(opts.concurrency) || 4));
  const promoCutoffIso = new Date(Date.now() - 168 * 3600 * 1000).toISOString();
  const today = new Date().toISOString().slice(0, 10);

  const searchTerms = [...new Set(names.flatMap((n) => expandSearchTermsForProductName(n)))];

  const out = [];
  const seen = new Set();
  const pushRows = (rows) => {
    for (const row of rows || []) {
      if (!row) continue;
      const key = rowKey(row);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(row);
    }
  };

  for (let i = 0; i < searchTerms.length; i += concurrency) {
    const chunk = searchTerms.slice(i, i + concurrency);
    const results = await Promise.all(
      chunk.map((term) => fetchByTerm(supabase, term, perNameLimit, promoCutoffIso, today))
    );
    for (const batch of results) pushRows(batch);
  }

  return out;
}
