/**
 * Grava lote de importação com status pendente de revisão.
 */
export async function confirmInsumoImport(supabase, lojaId, opts) {
  const {
    validRows,
    insights,
    columnMapping,
    origem = 'csv',
    nomeArquivo = null,
    erpUrl = null,
  } = opts;

  const rows = validRows || [];
  if (!rows.length) {
    return { ok: false, error: 'Nenhuma linha válida para importar.' };
  }

  const nowIso = new Date().toISOString();

  const { data: lote, error: loteErr } = await supabase
    .from('insumos_import_lotes')
    .insert({
      loja_id: lojaId,
      origem,
      nome_arquivo: nomeArquivo,
      erp_url: erpUrl,
      column_mapping: columnMapping || {},
      total_linhas: rows.length,
      linhas_validas: rows.length,
      linhas_erro: 0,
      insights: insights || null,
      status: 'pendente_revisao',
    })
    .select('id')
    .single();

  if (loteErr) {
    if (/insumos_import_lotes/i.test(loteErr.message)) {
      return { ok: false, error: 'Execute a migração run-insumos-import-controlado.sql no Supabase.' };
    }
    return { ok: false, error: loteErr.message };
  }

  const inserts = rows.map((r) => ({
    loja_id: lojaId,
    nome: r.nome,
    sku: r.sku,
    ean: r.ean,
    categoria: r.categoria,
    unidade: r.unidade || 'un',
    quantidade_atual: r.quantidade_atual,
    estoque_minimo: r.estoque_minimo,
    custo_medio: r.custo_medio,
    recorrente: true,
    ativo: false,
    status_revisao: 'pendente',
    import_lote_id: lote.id,
    updated_at: nowIso,
  }));

  const { data: inserted, error: insErr } = await supabase
    .from('insumos_loja')
    .insert(inserts)
    .select('id');

  if (insErr) {
    await supabase.from('insumos_import_lotes').delete().eq('id', lote.id);
    return { ok: false, error: insErr.message };
  }

  return {
    ok: true,
    lote_id: lote.id,
    imported: inserted?.length ?? rows.length,
    insights,
  };
}

/** Aprova lote ou lista de insumos pendentes → ativos. */
export async function approveInsumoImport(supabase, lojaId, { loteId, insumoIds } = {}) {
  const nowIso = new Date().toISOString();
  let query = supabase
    .from('insumos_loja')
    .update({
      status_revisao: 'aprovado',
      ativo: true,
      updated_at: nowIso,
    })
    .eq('loja_id', lojaId)
    .eq('status_revisao', 'pendente');

  if (loteId) query = query.eq('import_lote_id', loteId);
  if (insumoIds?.length) query = query.in('id', insumoIds);

  const { data, error } = await query.select('id');
  if (error) return { ok: false, error: error.message };

  if (loteId && data?.length) {
    await supabase
      .from('insumos_import_lotes')
      .update({ status: 'confirmado', confirmed_at: nowIso })
      .eq('id', loteId)
      .eq('loja_id', lojaId);
  }

  return { ok: true, approved: data?.length ?? 0 };
}
