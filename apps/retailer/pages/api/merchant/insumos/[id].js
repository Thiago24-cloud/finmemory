import { requireMerchantApi } from '../../../../lib/merchant/requireMerchantApi';
import {
  mapInsumoRowToApi,
  normalizeEanDigits,
  normalizeInsumoUnidade,
} from '../../../../lib/merchant/mapInsumoRow';
import { enrichInsumoImage } from '../../../../lib/merchant/insumos/enrichInsumoImage';

const INSUMO_SELECT =
  'id, loja_id, nome, sku, ean, categoria, unidade, estoque_minimo, quantidade_atual, custo_medio, recorrente, ativo, status_revisao, imagem_url, imagem_source, imagem_atualizada_em, na_cesta, cesta_quantidade, cesta_oferta, created_at, updated_at';

function cleanImageUrl(value) {
  const url = String(value || '').trim();
  return url.startsWith('https://') ? url.slice(0, 2048) : null;
}

function isMissingTableError(error) {
  return /insumos_loja/i.test(String(error?.message || ''));
}

/**
 * PATCH  /api/merchant/insumos/[id]
 * DELETE /api/merchant/insumos/[id] — desativa (soft delete)
 */
export default async function handler(req, res) {
  const auth = await requireMerchantApi(req, res);
  if (!auth) return;

  const insumoId = String(req.query?.id || '').trim();
  if (!insumoId) {
    return res.status(400).json({ error: 'ID do insumo inválido.' });
  }

  const { supabase, store } = auth;
  const lojaId = store.id;

  const { data: existing, error: fetchErr } = await supabase
    .from('insumos_loja')
    .select(INSUMO_SELECT)
    .eq('id', insumoId)
    .eq('loja_id', lojaId)
    .maybeSingle();

  if (fetchErr) {
    if (isMissingTableError(fetchErr)) {
      return res.status(503).json({ error: 'Tabela insumos_loja ainda não existe.' });
    }
    return res.status(500).json({ error: fetchErr.message });
  }
  if (!existing) {
    return res.status(404).json({ error: 'Insumo não encontrado.' });
  }

  if (req.method === 'DELETE') {
    const { data: row, error: delErr } = await supabase
      .from('insumos_loja')
      .update({ ativo: false, updated_at: new Date().toISOString() })
      .eq('id', insumoId)
      .eq('loja_id', lojaId)
      .select(
        'id, loja_id, nome, ean, unidade, estoque_minimo, quantidade_atual, custo_medio, recorrente, ativo, created_at, updated_at'
      )
      .single();

    if (delErr) {
      return res.status(500).json({ error: delErr.message });
    }
    return res.status(200).json({ insumo: mapInsumoRowToApi(row), removed: true });
  }

  if (req.method === 'PATCH') {
    const body = req.body || {};
    const patch = { updated_at: new Date().toISOString() };

    if (body.nome != null || body.name != null) {
      const nome = String(body.nome ?? body.name).trim().slice(0, 200);
      if (nome.length < 2) return res.status(400).json({ error: 'Nome inválido.' });
      patch.nome = nome;
    }

    if (body.ean !== undefined || body.gtin !== undefined) {
      const ean = normalizeEanDigits(body.ean ?? body.gtin);
      if (ean) {
        const { data: dup } = await supabase
          .from('insumos_loja')
          .select('id')
          .eq('loja_id', lojaId)
          .eq('ean', ean)
          .eq('ativo', true)
          .neq('id', insumoId)
          .maybeSingle();
        if (dup?.id) {
          return res.status(409).json({ error: 'Outro insumo já usa este código de barras.' });
        }
      }
      patch.ean = ean;
    }

    if (body.unidade != null) {
      patch.unidade = normalizeInsumoUnidade(body.unidade);
    }

    if (body.estoque_minimo != null || body.estoqueMinimo != null) {
      const min = Number(body.estoque_minimo ?? body.estoqueMinimo);
      if (!Number.isFinite(min) || min < 0) {
        return res.status(400).json({ error: 'Estoque mínimo inválido.' });
      }
      patch.estoque_minimo = Math.round(min * 1000) / 1000;
    }

    if (body.quantidade_atual != null || body.quantidadeAtual != null) {
      const qty = Number(body.quantidade_atual ?? body.quantidadeAtual);
      if (!Number.isFinite(qty) || qty < 0) {
        return res.status(400).json({ error: 'Quantidade atual inválida.' });
      }
      patch.quantidade_atual = Math.round(qty * 1000) / 1000;
    }

    if (body.custo_medio !== undefined || body.custoMedio !== undefined) {
      const raw = body.custo_medio ?? body.custoMedio;
      if (raw === null || raw === '') {
        patch.custo_medio = null;
      } else {
        const custo = Number(raw);
        if (!Number.isFinite(custo) || custo < 0) {
          return res.status(400).json({ error: 'Custo médio inválido.' });
        }
        patch.custo_medio = Math.round(custo * 100) / 100;
      }
    }

    if (typeof body.recorrente === 'boolean') {
      patch.recorrente = body.recorrente;
    }

    if (typeof body.ativo === 'boolean') {
      patch.ativo = body.ativo;
    }

    if (typeof body.na_cesta === 'boolean') {
      patch.na_cesta = body.na_cesta;
      if (!body.na_cesta) {
        patch.cesta_quantidade = null;
        patch.cesta_oferta = null;
      }
    }

    if (body.cesta_quantidade != null || body.quantidadeCesta != null) {
      const qty = Number(body.cesta_quantidade ?? body.quantidadeCesta);
      if (!Number.isFinite(qty) || qty <= 0) {
        return res.status(400).json({ error: 'Quantidade da cesta inválida.' });
      }
      patch.cesta_quantidade = Math.round(qty * 1000) / 1000;
      patch.na_cesta = true;
    }

    if (body.cesta_oferta !== undefined) {
      if (body.cesta_oferta === null) {
        patch.cesta_oferta = null;
      } else if (typeof body.cesta_oferta === 'object') {
        const preco = Number(body.cesta_oferta.preco);
        if (!Number.isFinite(preco) || preco <= 0) {
          return res.status(400).json({ error: 'Oferta da cesta inválida.' });
        }
        patch.cesta_oferta = {
          lugar_id: body.cesta_oferta.lugar_id || null,
          nome_loja: String(body.cesta_oferta.nome_loja || 'Mercado').trim() || 'Mercado',
          produto_nome: String(body.cesta_oferta.produto_nome || '').trim(),
          preco,
          lat: body.cesta_oferta.lat ?? null,
          lng: body.cesta_oferta.lng ?? null,
        };
      }
    }

    if (body.imagem_url !== undefined || body.image_url !== undefined || body.imageUrl !== undefined) {
      const imagemUrl = cleanImageUrl(body.imagem_url ?? body.image_url ?? body.imageUrl);
      patch.imagem_url = imagemUrl;
      patch.imagem_atualizada_em = patch.updated_at;
      if (body.imagem_source) {
        patch.imagem_source = String(body.imagem_source).trim().slice(0, 80);
      } else if (imagemUrl) {
        patch.imagem_source = 'custom';
      }
    } else if (body.imagem_source) {
      patch.imagem_source = String(body.imagem_source).trim().slice(0, 80);
    }

    const { data: row, error: updErr } = await supabase
      .from('insumos_loja')
      .update(patch)
      .eq('id', insumoId)
      .eq('loja_id', lojaId)
      .select(INSUMO_SELECT)
      .single();

    if (updErr) {
      return res.status(500).json({ error: updErr.message });
    }

    const nameChanged = patch.nome != null && patch.nome !== existing.nome;
    const eanChanged = patch.ean !== undefined && patch.ean !== existing.ean;
    const isCustom = String(row.imagem_source || '').toLowerCase() === 'custom';

    if (!isCustom && (nameChanged || eanChanged) && body.imagem_url === undefined) {
      await enrichInsumoImage(supabase, {
        lojaId,
        insumoId,
        nome: row.nome,
        ean: row.ean,
        currentImageUrl: row.imagem_url,
        currentImageSource: row.imagem_source,
        nowIso: patch.updated_at,
      }).catch(() => {});

      const { data: enriched } = await supabase
        .from('insumos_loja')
        .select(INSUMO_SELECT)
        .eq('id', insumoId)
        .maybeSingle();

      return res.status(200).json({ insumo: mapInsumoRowToApi(enriched || row) });
    }

    return res.status(200).json({ insumo: mapInsumoRowToApi(row) });
  }

  res.setHeader('Allow', 'PATCH, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
}
