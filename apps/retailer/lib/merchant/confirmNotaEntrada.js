import { normalizeEanDigits, normalizeInsumoUnidade } from './mapInsumoRow';

function roundQty(n) {
  return Math.round(Number(n) * 1000) / 1000;
}

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

/**
 * Atualiza quantidade e custo médio ponderado.
 */
function nextStockState(currentQty, currentCost, addQty, unitCost) {
  const oldQ = Number(currentQty) || 0;
  const addQ = roundQty(addQty);
  const newQ = roundQty(oldQ + addQ);
  let newCost = currentCost != null ? Number(currentCost) : null;
  if (unitCost != null && Number.isFinite(unitCost) && addQ > 0) {
    const oldCost = oldQ > 0 && newCost != null ? newCost : unitCost;
    const totalValue = oldQ * oldCost + addQ * unitCost;
    newCost = newQ > 0 ? roundMoney(totalValue / newQ) : unitCost;
  }
  return { quantidade_atual: newQ, custo_medio: newCost };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ lojaId: string, fornecedor?: string, chave_nfe?: string, valor_total?: number, imagem_url?: string, itens: object[] }} input
 */
export async function confirmNotaEntrada(supabase, input) {
  const lojaId = input.lojaId;
  const itens = Array.isArray(input.itens) ? input.itens : [];
  if (itens.length === 0) {
    return { ok: false, status: 400, error: 'Informe ao menos um item da nota.' };
  }

  const normalizedLines = itens
    .map((row, idx) => {
      const nome = String(row.nome || row.name || '').trim().slice(0, 200);
      if (!nome || nome.length < 2) return null;
      const quantidade = roundQty(row.quantidade ?? row.quantity ?? 1);
      if (!Number.isFinite(quantidade) || quantidade <= 0) return null;
      const precoRaw = row.preco_unitario ?? row.price;
      const preco_unitario =
        precoRaw != null && precoRaw !== '' && Number.isFinite(Number(precoRaw))
          ? roundMoney(precoRaw)
          : null;
      return {
        nome,
        ean: normalizeEanDigits(row.ean),
        quantidade,
        preco_unitario,
        insumo_id: row.insumo_id || null,
        criar_insumo: Boolean(row.criar_insumo),
        unidade: normalizeInsumoUnidade(row.unidade || 'un'),
        sort_order: idx,
      };
    })
    .filter(Boolean);

  if (normalizedLines.length === 0) {
    return { ok: false, status: 400, error: 'Nenhum item válido na nota.' };
  }

  let valorTotal = input.valor_total != null ? roundMoney(input.valor_total) : null;
  if (valorTotal == null) {
    valorTotal = roundMoney(
      normalizedLines.reduce((acc, line) => acc + (line.preco_unitario || 0) * line.quantidade, 0)
    );
  }

  const nowIso = new Date().toISOString();
  const { data: nota, error: notaErr } = await supabase
    .from('notas_entrada_loja')
    .insert({
      loja_id: lojaId,
      fornecedor: input.fornecedor ? String(input.fornecedor).trim().slice(0, 200) : null,
      chave_nfe: input.chave_nfe ? String(input.chave_nfe).replace(/\D/g, '').slice(0, 44) : null,
      valor_total: valorTotal,
      imagem_url: input.imagem_url ? String(input.imagem_url).trim().slice(0, 2048) : null,
      status: 'confirmada',
      updated_at: nowIso,
    })
    .select('id, loja_id, fornecedor, chave_nfe, valor_total, status, created_at')
    .single();

  if (notaErr || !nota?.id) {
    return { ok: false, status: 500, error: notaErr?.message || 'Erro ao registrar nota.' };
  }

  const createdInsumoIds = [];
  let movimentos = 0;

  try {
    for (const line of normalizedLines) {
      let insumoId = line.insumo_id;

      if (!insumoId && line.criar_insumo) {
        const { data: newInsumo, error: insErr } = await supabase
          .from('insumos_loja')
          .insert({
            loja_id: lojaId,
            nome: line.nome,
            ean: line.ean,
            unidade: line.unidade,
            estoque_minimo: 0,
            quantidade_atual: 0,
            custo_medio: line.preco_unitario,
            recorrente: true,
            ativo: true,
            updated_at: nowIso,
          })
          .select('id, quantidade_atual, custo_medio')
          .single();

        if (insErr || !newInsumo?.id) {
          throw new Error(insErr?.message || 'Erro ao criar insumo.');
        }
        insumoId = newInsumo.id;
        createdInsumoIds.push(insumoId);
      }

      if (!insumoId) {
        throw new Error(`Vincule ou crie insumo para: ${line.nome}`);
      }

      const { data: insumoRow, error: fetchInsumoErr } = await supabase
        .from('insumos_loja')
        .select('id, quantidade_atual, custo_medio')
        .eq('id', insumoId)
        .eq('loja_id', lojaId)
        .maybeSingle();

      if (fetchInsumoErr || !insumoRow) {
        throw new Error(`Insumo não encontrado: ${line.nome}`);
      }

      const stock = nextStockState(
        insumoRow.quantidade_atual,
        insumoRow.custo_medio,
        line.quantidade,
        line.preco_unitario
      );

      const { error: movErr } = await supabase.from('insumo_movimentacoes').insert({
        insumo_id: insumoId,
        loja_id: lojaId,
        tipo: 'entrada',
        quantidade: line.quantidade,
        custo_unitario: line.preco_unitario,
        origem: 'nota_fiscal',
        nota_entrada_id: nota.id,
        observacao: `NF ${input.fornecedor || ''}`.trim().slice(0, 200) || null,
      });

      if (movErr) throw new Error(movErr.message);

      const { error: updErr } = await supabase
        .from('insumos_loja')
        .update({
          quantidade_atual: stock.quantidade_atual,
          custo_medio: stock.custo_medio,
          updated_at: nowIso,
        })
        .eq('id', insumoId)
        .eq('loja_id', lojaId);

      if (updErr) throw new Error(updErr.message);

      const { error: itemErr } = await supabase.from('notas_entrada_itens').insert({
        nota_id: nota.id,
        insumo_id: insumoId,
        nome: line.nome,
        ean: line.ean,
        quantidade: line.quantidade,
        preco_unitario: line.preco_unitario,
        sort_order: line.sort_order,
      });

      if (itemErr) throw new Error(itemErr.message);
      movimentos += 1;
    }
  } catch (err) {
    await supabase.from('notas_entrada_itens').delete().eq('nota_id', nota.id);
    await supabase.from('insumo_movimentacoes').delete().eq('nota_entrada_id', nota.id);
    if (createdInsumoIds.length) {
      await supabase.from('insumos_loja').delete().in('id', createdInsumoIds);
    }
    await supabase.from('notas_entrada_loja').delete().eq('id', nota.id);
    return { ok: false, status: 500, error: err.message || 'Erro ao confirmar entrada.' };
  }

  return {
    ok: true,
    nota,
    movimentos,
    itens_confirmados: movimentos,
    insumos_criados: createdInsumoIds.length,
  };
}
