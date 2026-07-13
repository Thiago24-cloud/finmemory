import { mapProdutoRowToApi } from './mapProdutoRow';

const PRODUTO_SELECT =
  'id, loja_id, nome, descricao, preco_original, preco_oferta, em_oferta, quantidade_estoque, url_imagem, image_optimized_url, ean, categoria, imagem_source, insumo_id, status_disponivel, created_at, updated_at';

const PRODUTO_SELECT_FALLBACK =
  'id, loja_id, nome, descricao, preco_original, preco_oferta, em_oferta, quantidade_estoque, url_imagem, image_optimized_url, status_disponivel, created_at, updated_at';

function isMissingCatalogColumnError(error) {
  return /ean|categoria|imagem_source|insumo_id|column/i.test(String(error?.message || ''));
}

/**
 * Promove insumos com custo_medio > 0 para produtos_loja (catálogo da loja).
 * Equivalente ao sync-catalog do protótipo Product-Image-Match.
 */
export async function syncInsumosToCatalog(supabase, { lojaId }) {
  const { data: insumos, error: insErr } = await supabase
    .from('insumos_loja')
    .select(
      'id, nome, ean, categoria, custo_medio, quantidade_atual, imagem_url, imagem_source, ativo'
    )
    .eq('loja_id', lojaId)
    .eq('ativo', true)
    .order('nome', { ascending: true })
    .limit(500);

  if (insErr) {
    return { ok: false, error: insErr.message };
  }

  let { data: existing, error: existErr } = await supabase
    .from('produtos_loja')
    .select('id, insumo_id, nome')
    .eq('loja_id', lojaId)
    .limit(1000);

  if (existErr && isMissingCatalogColumnError(existErr)) {
    const retry = await supabase
      .from('produtos_loja')
      .select('id, nome')
      .eq('loja_id', lojaId)
      .limit(1000);
    existing = retry.data;
    existErr = retry.error;
  }

  if (existErr) {
    return { ok: false, error: existErr.message };
  }

  const byInsumoId = new Map(
    (existing || []).filter((p) => p.insumo_id).map((p) => [p.insumo_id, p])
  );
  const byNome = new Map(
    (existing || []).filter((p) => !p.insumo_id).map((p) => [String(p.nome || '').toLowerCase(), p])
  );

  let synced = 0;
  let skipped = 0;
  const results = [];
  const nowIso = new Date().toISOString();

  for (const insumo of insumos || []) {
    const price = Number(insumo.custo_medio);
    if (!Number.isFinite(price) || price <= 0) {
      skipped++;
      continue;
    }

    const qty = Number(insumo.quantidade_atual);
    const payload = {
      nome: insumo.nome,
      preco_oferta: Math.round(price * 100) / 100,
      preco_original: Math.round(price * 100) / 100,
      quantidade_estoque: Number.isFinite(qty) ? Math.max(0, Math.floor(qty)) : null,
      url_imagem: insumo.imagem_url || null,
      ean: insumo.ean || null,
      categoria: insumo.categoria || null,
      imagem_source: insumo.imagem_source || null,
      insumo_id: insumo.id,
      updated_at: nowIso,
    };

    const linked = byInsumoId.get(insumo.id);
    const byName = byNome.get(String(insumo.nome || '').toLowerCase());
    const target = linked || byName;

    if (target?.id) {
      let { data: row, error: updErr } = await supabase
        .from('produtos_loja')
        .update(payload)
        .eq('id', target.id)
        .eq('loja_id', lojaId)
        .select(PRODUTO_SELECT)
        .single();

      if (updErr && isMissingCatalogColumnError(updErr)) {
        const fallback = { ...payload };
        delete fallback.ean;
        delete fallback.categoria;
        delete fallback.imagem_source;
        delete fallback.insumo_id;
        const retry = await supabase
          .from('produtos_loja')
          .update(fallback)
          .eq('id', target.id)
          .eq('loja_id', lojaId)
          .select(PRODUTO_SELECT_FALLBACK)
          .single();
        row = retry.data;
        updErr = retry.error;
      }

      if (updErr) {
        skipped++;
        continue;
      }
      results.push(row);
    } else {
      let { data: row, error: insErr2 } = await supabase
        .from('produtos_loja')
        .insert({
          loja_id: lojaId,
          ...payload,
          em_oferta: false,
          status_disponivel: true,
        })
        .select(PRODUTO_SELECT)
        .single();

      if (insErr2 && isMissingCatalogColumnError(insErr2)) {
        const fallback = { ...payload };
        delete fallback.ean;
        delete fallback.categoria;
        delete fallback.imagem_source;
        delete fallback.insumo_id;
        const retry = await supabase
          .from('produtos_loja')
          .insert({
            loja_id: lojaId,
            ...fallback,
            em_oferta: false,
            status_disponivel: true,
          })
          .select(PRODUTO_SELECT_FALLBACK)
          .single();
        row = retry.data;
        insErr2 = retry.error;
      }

      if (insErr2) {
        skipped++;
        continue;
      }
      results.push(row);
      if (row?.insumo_id) byInsumoId.set(row.insumo_id, row);
    }

    synced++;
  }

  return {
    ok: true,
    synced,
    skipped,
    products: results.map(mapProdutoRowToApi),
  };
}
