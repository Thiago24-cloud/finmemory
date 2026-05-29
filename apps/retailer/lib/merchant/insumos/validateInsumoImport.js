import {
  normalizeEanDigits,
  normalizeInsumoUnidade,
} from '../mapInsumoRow';

function parseNumber(raw, { min = 0, allowNull = true } = {}) {
  if (raw == null || raw === '') return allowNull ? null : NaN;
  const s = String(raw).trim().replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  if (!Number.isFinite(n) || n < min) return NaN;
  return n;
}

function normalizeSku(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  return s.slice(0, 64);
}

/**
 * Valida linhas mapeadas antes de gravar no banco.
 * @param {object[]} mappedRows
 * @param {{ existingSkus?: Set<string>, existingEans?: Set<string>, knownCategories?: Set<string> }} ctx
 */
export function validateInsumoImportRows(mappedRows, ctx = {}) {
  const existingSkus = ctx.existingSkus || new Set();
  const existingEans = ctx.existingEans || new Set();
  const knownCategories = ctx.knownCategories || new Set();

  const seenSkus = new Set();
  const seenEans = new Set();
  const validRows = [];
  const errorRows = [];
  const suggestedCategories = new Set();

  for (const raw of mappedRows || []) {
    const rowNum = raw._row ?? '?';
    const errors = [];
    const warnings = [];

    const nome = String(raw.nome || '').trim().slice(0, 200);
    if (!nome || nome.length < 2) errors.push('Nome obrigatório (mín. 2 caracteres).');

    const sku = normalizeSku(raw.sku);
    if (sku) {
      if (seenSkus.has(sku)) errors.push(`SKU duplicado no arquivo: "${sku}".`);
      else seenSkus.add(sku);
      if (existingSkus.has(sku)) errors.push(`SKU "${sku}" já existe na loja.`);
    }

    const ean = normalizeEanDigits(raw.ean);
    if (raw.ean && !ean) warnings.push('EAN/GTIN inválido — será ignorado.');
    if (ean) {
      if (seenEans.has(ean)) errors.push(`EAN duplicado no arquivo: ${ean}.`);
      else seenEans.add(ean);
      if (existingEans.has(ean)) errors.push(`EAN ${ean} já cadastrado na loja.`);
    }

    const categoria = String(raw.categoria || '').trim().slice(0, 80) || null;
    if (categoria && !knownCategories.has(categoria.toLowerCase())) {
      suggestedCategories.add(categoria);
      warnings.push(`Categoria "${categoria}" será criada.`);
    }

    const unidade = normalizeInsumoUnidade(raw.unidade);
    const quantidadeAtual = parseNumber(raw.quantidade_atual, { min: 0, allowNull: false });
    if (Number.isNaN(quantidadeAtual)) errors.push('Quantidade em estoque inválida.');

    const estoqueMinimo = parseNumber(raw.estoque_minimo ?? 0, { min: 0, allowNull: false });
    if (Number.isNaN(estoqueMinimo)) errors.push('Estoque mínimo inválido.');

    const custoMedio = parseNumber(raw.custo_medio, { min: 0, allowNull: true });
    if (raw.custo_medio != null && raw.custo_medio !== '' && Number.isNaN(custoMedio)) {
      errors.push('Custo médio inválido.');
    }
    if (custoMedio != null && custoMedio > 50000) {
      warnings.push('Custo médio muito alto — confira se a coluna está correta.');
    }

    const item = {
      row: rowNum,
      nome,
      sku,
      ean,
      categoria,
      unidade,
      quantidade_atual: quantidadeAtual ?? 0,
      estoque_minimo: estoqueMinimo ?? 0,
      custo_medio: custoMedio,
      warnings,
    };

    if (errors.length) {
      errorRows.push({ ...item, errors });
    } else {
      validRows.push(item);
    }
  }

  return {
    valid_rows: validRows,
    error_rows: errorRows,
    suggested_categories: [...suggestedCategories],
    summary: {
      total: (mappedRows || []).length,
      valid: validRows.length,
      errors: errorRows.length,
    },
  };
}

/**
 * Insights pós-validação (capital parado, baixo giro).
 * @param {object[]} validRows
 */
export function computeImportInsights(validRows) {
  const rows = validRows || [];
  let capitalTotal = 0;
  let capitalBaixoGiro = 0;
  let itensBaixoGiro = 0;

  for (const r of rows) {
    const qty = Number(r.quantidade_atual) || 0;
    const cost = Number(r.custo_medio) || 0;
    const valor = qty * cost;
    capitalTotal += valor;
    const min = Number(r.estoque_minimo) || 0;
    const baixoGiro = min > 0 && qty > min * 3;
    if (baixoGiro) {
      capitalBaixoGiro += valor;
      itensBaixoGiro += 1;
    }
  }

  const pctParado =
    capitalTotal > 0 ? Math.round((capitalBaixoGiro / capitalTotal) * 1000) / 10 : 0;

  return {
    capital_total_estimado: Math.round(capitalTotal * 100) / 100,
    capital_baixo_giro: Math.round(capitalBaixoGiro * 100) / 100,
    pct_capital_parado: pctParado,
    itens_baixo_giro: itensBaixoGiro,
    total_itens: rows.length,
    mensagem:
      pctParado > 0
        ? `${pctParado}% do capital estimado está em insumos com estoque acima do ideal (possível baixo giro).`
        : 'Importação sem alertas de baixo giro — revise custos médios na etapa de revisão.',
  };
}

export async function loadExistingInsumoKeys(supabase, lojaId) {
  const { data } = await supabase
    .from('insumos_loja')
    .select('sku, ean, categoria')
    .eq('loja_id', lojaId);

  const existingSkus = new Set();
  const existingEans = new Set();
  const knownCategories = new Set();

  for (const row of data || []) {
    if (row.sku) existingSkus.add(String(row.sku).trim());
    if (row.ean) existingEans.add(String(row.ean).trim());
    if (row.categoria) knownCategories.add(String(row.categoria).trim().toLowerCase());
  }

  return { existingSkus, existingEans, knownCategories };
}
