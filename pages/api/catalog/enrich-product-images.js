import { createClient } from '@supabase/supabase-js';
import { checkCatalogEnrichSecret } from '../../../lib/catalog/checkCatalogEnrichSecret.js';
import { enrichBotFilaItemImages } from '../../../lib/catalog/enrichBotFilaImages.js';
import { enrichPricePointsImages } from '../../../lib/catalog/enrichPricePointsImages.js';
import { processImageSync } from '../../../lib/catalog/processImageSync.js';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * POST /api/catalog/enrich-product-images
 * Body:
 *   { filaId } — enriquece produtos da bot_promocoes_fila
 *   { mode: 'promocoes', limit?: number } — promocoes_supermercados sem imagem
 *   { mode: 'price_points', limit?: number, days?: number, storeName?, source? } — pontos do mapa
 *   { async?: true } — responde 202 e processa em background
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!checkCatalogEnrichSecret(req)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase service role não configurado' });
  }

  const filaId = req.body?.filaId || req.query?.filaId;
  const mode = String(req.body?.mode || (filaId ? 'bot_fila' : 'promocoes'));
  const limitRaw = Number(req.body?.limit ?? req.query?.limit ?? 40);
  const limit = Math.min(120, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 40));

  const daysRaw = Number(req.body?.days ?? req.query?.days ?? 7);
  const days = Math.min(30, Math.max(1, Number.isFinite(daysRaw) ? daysRaw : 7));
  const storeName = req.body?.storeName || req.query?.storeName || undefined;
  const source = req.body?.source || req.query?.source || undefined;

  const run = async () => {
    if (mode === 'bot_fila' && filaId) {
      return enrichBotFilaItemImages(supabase, String(filaId), { maxProducts: limit });
    }

    if (mode === 'price_points') {
      return enrichPricePointsImages(supabase, { limit, days, storeName, source });
    }

    const nowIso = new Date().toISOString();
    let query = supabase
      .from('promocoes_supermercados')
      .select('id, nome_produto, supermercado, product_id, imagem_url, tentativa_busca_imagem')
      .eq('ativo', true)
      .eq('tentativa_busca_imagem', false)
      .gt('expira_em', nowIso)
      .is('imagem_url', null)
      .order('atualizado_em', { ascending: false })
      .limit(limit);

    const { data: rows, error } = await query;
    if (error) {
      if (error.message?.includes('tentativa_busca_imagem')) {
        const fallback = await supabase
          .from('promocoes_supermercados')
          .select('id, nome_produto, supermercado, product_id, imagem_url')
          .eq('ativo', true)
          .gt('expira_em', nowIso)
          .is('imagem_url', null)
          .order('atualizado_em', { ascending: false })
          .limit(limit);
        if (fallback.error) throw new Error(fallback.error.message);
        return enrichPromocoesRows(supabase, fallback.data || []);
      }
      throw new Error(error.message);
    }

    const targets = (rows || []).filter((r) => !r.tentativa_busca_imagem);
    return enrichPromocoesRows(supabase, targets);
  };

  try {
    if (req.body?.async === true) {
      void run().catch((e) => console.error('[catalog/enrich-product-images async]', e?.message || e));
      return res.status(202).json({ ok: true, accepted: true, mode, filaId: filaId || null });
    }

    const payload = await run();
    return res.status(200).json(payload);
  } catch (e) {
    console.error('[catalog/enrich-product-images]', e?.message || e);
    return res.status(500).json({ error: e?.message || 'Erro interno' });
  }
}

async function enrichPromocoesRows(supabase, rows) {
  const results = [];
  for (const row of rows) {
    // eslint-disable-next-line no-await-in-loop
    const result = await processImageSync(
      supabase,
      {
        id: row.id,
        nome: row.nome_produto,
        product_id: row.product_id,
        persist: { table: 'promocoes_supermercados', id: row.id },
      },
      { storeName: row.supermercado }
    );
    results.push({ id: row.id, nome_produto: row.nome_produto, ...result });
  }

  return {
    ok: true,
    mode: 'promocoes',
    tried: rows.length,
    enriched: results.filter((r) => r.status === 'enriched').length,
    not_found: results.filter((r) => r.status === 'not_found').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    results: results.slice(0, 50),
  };
}
