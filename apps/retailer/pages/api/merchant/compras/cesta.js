import { requireMerchantApi } from '../../../../lib/merchant/requireMerchantApi';
import { mapInsumoRowToApi } from '../../../../lib/merchant/mapInsumoRow';
import {
  CESTA_INSUMO_SELECT,
  fetchCestaCompareForStore,
  isMissingCestaColumnError,
} from '../../../../lib/merchant/compras/fetchCestaCompare';
import { normalizeMapOffer } from '../../../../lib/merchant/compras/cestaCompare';
import { enrichInsumoMatchFromCatalog } from '../../../../lib/merchant/compras/enrichInsumoMatch';

/**
 * GET  /api/merchant/compras/cesta — cesta + compare mapa
 * POST /api/merchant/compras/cesta — add/remove/update itens
 */
export default async function handler(req, res) {
  const auth = await requireMerchantApi(req, res);
  if (!auth) return;

  const { supabase, store } = auth;
  const lojaId = store.id;

  if (req.method === 'GET') {
    const result = await fetchCestaCompareForStore(supabase, lojaId);
    if (!result.ok) {
      console.warn('[compras/cesta GET]', result.error?.message);
      return res.status(500).json({ error: 'Não foi possível carregar a cesta de compras.' });
    }
    if (!result.cestaAvailable) {
      return res.status(503).json({
        error:
          'Cesta de compras ainda não disponível. Execute a migration insumos_loja_cesta_compras no Supabase.',
        code: 'CESTA_MIGRATION_REQUIRED',
      });
    }
    return res.status(200).json({
      insumos: result.insumos,
      ...result.compare,
    });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const action = String(body.action || 'update').trim();

    if (action === 'add') {
      const insumoId = String(body.insumoId || body.insumo_id || '').trim();
      if (!insumoId) {
        return res.status(400).json({ error: 'Informe insumoId.' });
      }

      const patch = {
        na_cesta: true,
        updated_at: new Date().toISOString(),
      };
      if (body.cesta_quantidade != null || body.quantidade != null) {
        const qty = Number(body.cesta_quantidade ?? body.quantidade);
        if (Number.isFinite(qty) && qty > 0) {
          patch.cesta_quantidade = Math.round(qty * 1000) / 1000;
        }
      }

      const { data: row, error } = await supabase
        .from('insumos_loja')
        .update(patch)
        .eq('id', insumoId)
        .eq('loja_id', lojaId)
        .eq('ativo', true)
        .select(CESTA_INSUMO_SELECT)
        .maybeSingle();

      if (error) {
        if (isMissingCestaColumnError(error)) {
          return res.status(503).json({ error: 'Migration da cesta pendente no Supabase.', code: 'CESTA_MIGRATION_REQUIRED' });
        }
        return res.status(500).json({ error: error.message });
      }
      if (!row) {
        return res.status(404).json({ error: 'Insumo não encontrado.' });
      }

      await enrichInsumoMatchFromCatalog(supabase, {
        lojaId,
        insumoId,
        nome: row.nome,
        ean: row.ean,
        currentImageUrl: row.imagem_url,
      });

      const refreshed = await fetchCestaCompareForStore(supabase, lojaId, { autoEnrichMatch: false });
      return res.status(200).json({
        insumo: mapInsumoRowToApi(row),
        insumos: refreshed.ok ? refreshed.insumos : undefined,
        ...(refreshed.ok ? refreshed.compare : {}),
      });
    }

    if (action === 'remove') {
      const insumoId = String(body.insumoId || body.insumo_id || '').trim();
      if (!insumoId) {
        return res.status(400).json({ error: 'Informe insumoId.' });
      }

      const { error } = await supabase
        .from('insumos_loja')
        .update({
          na_cesta: false,
          cesta_quantidade: null,
          cesta_oferta: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', insumoId)
        .eq('loja_id', lojaId);

      if (error) {
        if (isMissingCestaColumnError(error)) {
          return res.status(503).json({ error: 'Migration da cesta pendente no Supabase.', code: 'CESTA_MIGRATION_REQUIRED' });
        }
        return res.status(500).json({ error: error.message });
      }

      const refreshed = await fetchCestaCompareForStore(supabase, lojaId);
      if (!refreshed.ok) {
        return res.status(500).json({ error: 'Cesta atualizada, mas falhou ao recarregar preços.' });
      }
      return res.status(200).json({
        removed: insumoId,
        insumos: refreshed.insumos,
        ...refreshed.compare,
      });
    }

    if (action === 'sync_low_stock') {
      const { data: lowStock, error: fetchErr } = await supabase
        .from('insumos_loja')
        .select('id, quantidade_atual, estoque_minimo')
        .eq('loja_id', lojaId)
        .eq('ativo', true)
        .limit(200);

      if (fetchErr) {
        return res.status(500).json({ error: fetchErr.message });
      }

      const toAdd = (lowStock || []).filter((row) => {
        const qty = Number(row.quantidade_atual);
        const min = Number(row.estoque_minimo);
        return Number.isFinite(min) && min > 0 && Number.isFinite(qty) && qty <= min;
      });

      if (toAdd.length === 0) {
        const refreshed = await fetchCestaCompareForStore(supabase, lojaId);
        return res.status(200).json({
          synced: 0,
          insumos: refreshed.ok ? refreshed.insumos : [],
          ...(refreshed.ok ? refreshed.compare : {}),
        });
      }

      const ids = toAdd.map((r) => r.id);
      const { error: updErr } = await supabase
        .from('insumos_loja')
        .update({ na_cesta: true, updated_at: new Date().toISOString() })
        .in('id', ids)
        .eq('loja_id', lojaId);

      if (updErr) {
        if (isMissingCestaColumnError(updErr)) {
          return res.status(503).json({ error: 'Migration da cesta pendente no Supabase.', code: 'CESTA_MIGRATION_REQUIRED' });
        }
        return res.status(500).json({ error: updErr.message });
      }

      const refreshed = await fetchCestaCompareForStore(supabase, lojaId);
      return res.status(200).json({
        synced: ids.length,
        insumos: refreshed.ok ? refreshed.insumos : [],
        ...(refreshed.ok ? refreshed.compare : {}),
      });
    }

    // update (default)
    const insumoId = String(body.insumoId || body.insumo_id || '').trim();
    if (!insumoId) {
      return res.status(400).json({ error: 'Informe insumoId.' });
    }

    const patch = { updated_at: new Date().toISOString() };

    if (body.cesta_quantidade != null || body.quantidade != null) {
      const qty = Number(body.cesta_quantidade ?? body.quantidade);
      if (!Number.isFinite(qty) || qty <= 0) {
        return res.status(400).json({ error: 'Quantidade inválida.' });
      }
      patch.cesta_quantidade = Math.round(qty * 1000) / 1000;
    }

    if (body.cesta_oferta !== undefined || body.offer !== undefined) {
      const raw = body.cesta_oferta ?? body.offer;
      if (raw === null) {
        patch.cesta_oferta = null;
      } else {
        const offer = normalizeMapOffer(raw);
        if (!offer) {
          return res.status(400).json({ error: 'Oferta inválida.' });
        }
        patch.cesta_oferta = offer;
      }
    }

    if (typeof body.na_cesta === 'boolean') {
      patch.na_cesta = body.na_cesta;
      if (!body.na_cesta) {
        patch.cesta_quantidade = null;
        patch.cesta_oferta = null;
      }
    }

    const { data: row, error } = await supabase
      .from('insumos_loja')
      .update(patch)
      .eq('id', insumoId)
      .eq('loja_id', lojaId)
      .select(CESTA_INSUMO_SELECT)
      .maybeSingle();

    if (error) {
      if (isMissingCestaColumnError(error)) {
        return res.status(503).json({ error: 'Migration da cesta pendente no Supabase.', code: 'CESTA_MIGRATION_REQUIRED' });
      }
      return res.status(500).json({ error: error.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Insumo não encontrado.' });
    }

    const refreshed = await fetchCestaCompareForStore(supabase, lojaId);
    return res.status(200).json({
      insumo: mapInsumoRowToApi(row),
      insumos: refreshed.ok ? refreshed.insumos : undefined,
      ...(refreshed.ok ? refreshed.compare : {}),
    });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
