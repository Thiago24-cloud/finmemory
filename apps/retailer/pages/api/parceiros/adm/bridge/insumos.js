import { requireAdminCreditsApi } from '../../../../../lib/credits/requireCreditsApi';
import { mapInsumoRowToApi } from '../../../../../lib/merchant/mapInsumoRow';
import { BRIDGE_DEMO_INSUMOS, seedBridgeDemoInsumos } from '../../../../../lib/adm/bridgeDemoCatalog';

/**
 * GET  /api/parceiros/adm/bridge/insumos?store_id=
 * POST /api/parceiros/adm/bridge/insumos  { store_id } — grava catálogo demo na loja
 */
export default async function handler(req, res) {
  const ctx = await requireAdminCreditsApi(req, res);
  if (!ctx) return;

  if (req.method === 'POST') {
    const storeId = String(req.body?.store_id || '').trim();
    if (!storeId) return res.status(400).json({ error: 'Informe store_id.' });
    try {
      const result = await seedBridgeDemoInsumos(ctx.supabase, storeId);
      return res.status(201).json({
        success: true,
        message: `${result.created_count} insumo(s) demo gravados na loja.`,
        ...result,
      });
    } catch (err) {
      if (/insumos_loja/i.test(String(err.message))) {
        return res.status(503).json({ error: 'Execute a migração insumos_loja no Supabase.' });
      }
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const storeId = String(req.query.store_id || '').trim();
  if (!storeId) {
    return res.status(400).json({ error: 'Informe store_id.' });
  }

  try {
    const { data, error } = await ctx.supabase
      .from('insumos_loja')
      .select(
        'id, loja_id, nome, sku, ean, unidade, quantidade_atual, custo_medio, ativo, created_at, updated_at'
      )
      .eq('loja_id', storeId)
      .order('nome', { ascending: true })
      .limit(500);

    if (error) {
      if (/insumos_loja/i.test(String(error.message))) {
        return res.status(200).json({
          insumos: BRIDGE_DEMO_INSUMOS,
          is_demo_preview: true,
          demo_reason: 'Tabela insumos_loja não existe — exibindo preview.',
        });
      }
      throw new Error(error.message);
    }

    const insumos = (data || []).map((row) => ({
      ...mapInsumoRowToApi(row),
      consumer_external_code: row.consumer_external_code || null,
    }));

    if (insumos.length === 0) {
      return res.status(200).json({
        insumos: BRIDGE_DEMO_INSUMOS,
        is_demo_preview: true,
        demo_reason: 'Catálogo vazio — exibindo dados de demonstração do Replit.',
      });
    }

    return res.status(200).json({ insumos, is_demo_preview: false });
  } catch (err) {
    console.warn('[adm/bridge/insumos]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
