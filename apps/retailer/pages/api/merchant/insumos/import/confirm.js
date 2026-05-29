import { requireMerchantApi } from '../../../../../lib/merchant/requireMerchantApi';
import { suggestColumnMapping } from '../../../../../lib/merchant/insumos/finmemoryImportSchema';
import { parseCsvText, applyColumnMapping } from '../../../../../lib/merchant/insumos/parseCsvText';
import {
  validateInsumoImportRows,
  computeImportInsights,
  loadExistingInsumoKeys,
} from '../../../../../lib/merchant/insumos/validateInsumoImport';
import { confirmInsumoImport } from '../../../../../lib/merchant/insumos/confirmInsumoImport';

/**
 * POST /api/merchant/insumos/import/confirm
 * Grava itens validados como pendente de revisão (não ativos).
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await requireMerchantApi(req, res);
  if (!auth) return;

  const { supabase, store } = auth;
  const body = req.body || {};
  const csvText = body.csvText ?? body.csv_text ?? '';
  const columnMapping = body.columnMapping ?? body.column_mapping ?? null;
  const erpUrl = body.erpUrl ?? body.erp_url ?? null;
  const fileName = body.fileName ?? body.file_name ?? null;
  const origem = erpUrl ? 'erp_csv' : 'csv';

  if (!csvText || !String(csvText).trim()) {
    return res.status(400).json({ error: 'Envie o conteúdo CSV (csvText).' });
  }

  const { headers, rows } = parseCsvText(csvText);
  const mapping = columnMapping || suggestColumnMapping(headers);
  if (!mapping.nome) {
    return res.status(400).json({ error: 'Mapeie a coluna Nome antes de confirmar.' });
  }

  const mappedRows = applyColumnMapping(rows, headers, mapping);
  const ctx = await loadExistingInsumoKeys(supabase, store.id);
  const validation = validateInsumoImportRows(mappedRows, ctx);

  if (!validation.valid_rows.length) {
    return res.status(400).json({
      error: 'Nenhuma linha válida. Corrija os erros antes de importar.',
      validation,
    });
  }

  const insights = computeImportInsights(validation.valid_rows);
  const result = await confirmInsumoImport(supabase, store.id, {
    validRows: validation.valid_rows,
    insights,
    columnMapping: mapping,
    origem,
    nomeArquivo: fileName,
    erpUrl,
  });

  if (!result.ok) {
    return res.status(result.error?.includes('migração') ? 503 : 500).json({ error: result.error });
  }

  return res.status(201).json({
    ok: true,
    lote_id: result.lote_id,
    imported: result.imported,
    pendente_revisao: result.imported,
    validation_summary: validation.summary,
    insights: result.insights,
    message:
      `${result.imported} itens importados como pendente de revisão. Revise custos médios e confirme para ativar.`,
  });
}
