import { requireMerchantApi } from '../../../../lib/merchant/requireMerchantApi';
import { scanStockByBarcode, applyStockDelta } from '../../../../lib/merchant/estoque/scanStockByBarcode';

function parseBody(req) {
  if (typeof req.body === 'object' && req.body !== null) return req.body;
  if (typeof req.body === 'string' && req.body.trim()) {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return {};
}

function mapResultToHttp(res, result) {
  if (result.status === 'invalid_ean' || result.status === 'invalid_delta') {
    return res.status(400).json({ error: result.message, code: result.status });
  }
  if (result.status === 'table_missing') {
    return res.status(503).json({
      error: 'Tabela insumos_loja ainda não existe. Execute a migração no Supabase.',
    });
  }
  if (result.status === 'not_found') {
    return res.status(404).json({
      error: 'Produto não cadastrado.',
      code: 'product_not_found',
      ean: result.ean ?? null,
      insumoId: result.insumoId ?? null,
      suggestCreate: true,
    });
  }
  if (result.status === 'insufficient_stock') {
    return res.status(409).json({
      error: 'Estoque insuficiente para esta saída.',
      code: 'insufficient_stock',
      ean: result.ean,
      insumo: result.insumo,
      quantidade_atual: result.quantidade_atual,
    });
  }
  return res.status(200).json({
    ok: true,
    direction: result.direction,
    appliedDelta: result.appliedDelta,
    ean: result.ean,
    insumoId: result.insumoId,
    insumo: result.insumo,
  });
}

/**
 * POST /api/merchant/estoque/scan
 * Body: { ean?, insumoId?, direction: "in"|"out", delta?: number }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await requireMerchantApi(req, res);
  if (!auth) return;

  const body = parseBody(req);
  const direction = body.direction === 'out' ? 'out' : 'in';
  const delta = body.delta != null ? Number(body.delta) : 1;
  const insumoId = String(body.insumoId || body.insumo_id || '').trim();
  const ean = body.ean ?? body.gtin ?? body.barcode;

  try {
    const result = insumoId
      ? await applyStockDelta(auth.supabase, {
          lojaId: auth.store.id,
          insumoId,
          direction,
          delta,
        })
      : await scanStockByBarcode(auth.supabase, {
          lojaId: auth.store.id,
          ean,
          direction,
          delta,
        });

    return mapResultToHttp(res, result);
  } catch (error) {
    console.error('[estoque/scan]', error?.message || error);
    return res.status(500).json({ error: error?.message || 'Erro ao atualizar estoque.' });
  }
}
