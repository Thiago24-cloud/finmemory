import { requireMerchantApi } from '../../../../../lib/merchant/requireMerchantApi';
import { FINMEMORY_IMPORT_FIELDS, suggestColumnMapping } from '../../../../../lib/merchant/insumos/finmemoryImportSchema';
import { parseCsvText, applyColumnMapping } from '../../../../../lib/merchant/insumos/parseCsvText';
import {
  validateInsumoImportRows,
  computeImportInsights,
  loadExistingInsumoKeys,
} from '../../../../../lib/merchant/insumos/validateInsumoImport';

/**
 * POST /api/merchant/insumos/import/validate
 * Valida CSV/ERP antes de gravar — retorna erros, sugestões e insights.
 *
 * Body: { csvText?, columnMapping?, erpUrl?, fileName? }
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

  if (!csvText || !String(csvText).trim()) {
    return res.status(400).json({ error: 'Envie o conteúdo CSV (csvText).' });
  }

  const { headers, rows } = parseCsvText(csvText);
  if (!headers.length) {
    return res.status(400).json({ error: 'CSV vazio ou sem cabeçalho.' });
  }

  const mapping = columnMapping || suggestColumnMapping(headers);
  const nomeCol = mapping.nome;
  if (!nomeCol || !headers.includes(nomeCol)) {
    return res.status(400).json({
      error: 'Mapeie a coluna "Nome do insumo" antes de validar.',
      headers,
      suggested_mapping: suggestColumnMapping(headers),
      fields: FINMEMORY_IMPORT_FIELDS,
    });
  }

  const mappedRows = applyColumnMapping(rows, headers, mapping);
  const ctx = await loadExistingInsumoKeys(supabase, store.id);
  const validation = validateInsumoImportRows(mappedRows, ctx);
  const insights = computeImportInsights(validation.valid_rows);

  return res.status(200).json({
    ok: true,
    headers,
    column_mapping: mapping,
    suggested_mapping: suggestColumnMapping(headers),
    fields: FINMEMORY_IMPORT_FIELDS,
    validation,
    insights,
    erp_url: erpUrl,
    file_name: body.fileName ?? body.file_name ?? null,
    onboarding_hint:
      'Importe seu estoque inicial aqui. Para manter custos e quantidades atualizados sem planilha, use Entrada por nota fiscal (foto ou QR).',
  });
}
