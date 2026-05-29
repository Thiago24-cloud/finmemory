'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Upload,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  X,
  ArrowRight,
  Link2,
  Table2,
  Sparkles,
} from 'lucide-react';
import { painelApi } from '../../lib/merchant/painelApiPaths';
import { FINMEMORY_IMPORT_FIELDS } from '../../lib/merchant/insumos/finmemoryImportSchema';

function formatBrl(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));
}

/**
 * Assistente de importação controlada: upload CSV → mapeamento → validação → pendente → aprovação.
 */
export function MerchantInsumoImportFlow({ onConfirmed, onClose, pendingCount = 0, onApprovePending }) {
  const fileRef = useRef(null);
  const [step, setStep] = useState('upload');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [erpUrl, setErpUrl] = useState('');
  const [headers, setHeaders] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});
  const [validation, setValidation] = useState(null);
  const [insights, setInsights] = useState(null);
  const [loteId, setLoteId] = useState(null);
  const [importedCount, setImportedCount] = useState(0);

  const fieldOptions = useMemo(
    () => [{ value: '', label: '— Ignorar —' }, ...headers.map((h) => ({ value: h, label: h }))],
    [headers]
  );

  const readFile = useCallback((file) => {
    setError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result || '');
      setCsvText(text);
      setFileName(file.name);
      setStep('mapping');
    };
    reader.onerror = () => setError('Não foi possível ler o arquivo.');
    reader.readAsText(file, 'UTF-8');
  }, []);

  const runValidate = async (mapping) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(painelApi.insumosImportValidate, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvText,
          columnMapping: mapping,
          erpUrl: erpUrl || null,
          fileName,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Erro na validação.');
        if (data.suggested_mapping) {
          setColumnMapping(data.suggested_mapping);
          setHeaders(data.headers || []);
        }
        return;
      }
      setHeaders(data.headers || []);
      setColumnMapping(data.column_mapping || mapping);
      setValidation(data.validation);
      setInsights(data.insights);
      setStep('preview');
    } catch {
      setError('Erro de rede ao validar.');
    } finally {
      setLoading(false);
    }
  };

  const onMappingNext = () => {
    if (!columnMapping.nome) {
      setError('Associe pelo menos a coluna "Nome do insumo".');
      return;
    }
    void runValidate(columnMapping);
  };

  const onConfirmImport = async () => {
    if (!validation?.valid_rows?.length) {
      setError('Nenhuma linha válida para importar.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(painelApi.insumosImportConfirm, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvText,
          columnMapping,
          erpUrl: erpUrl || null,
          fileName,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Erro ao importar.');
        return;
      }
      setLoteId(data.lote_id);
      setImportedCount(data.imported ?? 0);
      setInsights(data.insights || insights);
      setStep('done');
    } catch {
      setError('Erro de rede ao confirmar importação.');
    } finally {
      setLoading(false);
    }
  };

  const onApprove = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(painelApi.insumosImportApprove, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lote_id: loteId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Erro ao aprovar.');
        return;
      }
      onConfirmed?.();
      onClose?.();
    } catch {
      setError('Erro de rede ao aprovar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#39FF14]/25 bg-[#39FF14]/[0.04] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-bold m-0 flex items-center gap-2">
            <Upload className="h-4 w-4 text-[#39FF14]" aria-hidden />
            Importação de estoque
          </h3>
          <p className="text-[11px] text-white/45 mt-1 m-0 leading-relaxed">
            Importe seu estoque inicial — a manutenção sem esforço vem com entrada por NF (foto/QR).
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10"
          aria-label="Fechar importação"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {error ? (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 mb-3 m-0" role="alert">
          {error}
        </p>
      ) : null}

      {step === 'upload' ? (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-white/60 mb-1.5">CSV exportado do ERP</label>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) readFile(f);
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full rounded-xl border border-dashed border-white/20 bg-white/[0.03] px-4 py-8 text-sm text-white/70 hover:border-[#39FF14]/40 hover:bg-[#39FF14]/5 transition-colors"
            >
              <Upload className="h-6 w-6 mx-auto mb-2 text-white/40" aria-hidden />
              Clique para enviar CSV (Bling, Tiny, planilha…)
            </button>
          </div>
          <div>
            <label htmlFor="erp-url" className="block text-xs font-semibold text-white/60 mb-1.5 flex items-center gap-1">
              <Link2 className="h-3 w-3" aria-hidden />
              Link da API do ERP (opcional — Sprint 2)
            </label>
            <input
              id="erp-url"
              type="url"
              value={erpUrl}
              onChange={(e) => setErpUrl(e.target.value)}
              placeholder="https://api.bling.com.br/..."
              className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-white/30"
            />
          </div>
        </div>
      ) : null}

      {step === 'mapping' ? (
        <div className="space-y-4">
          <p className="text-xs text-white/55 m-0 flex items-center gap-1.5">
            <Table2 className="h-3.5 w-3.5" aria-hidden />
            Associe as colunas do seu CSV aos campos FinMemory — sem adaptar a planilha.
          </p>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {FINMEMORY_IMPORT_FIELDS.map((field) => (
              <div key={field.key} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-full sm:w-40 text-white/70 shrink-0">
                  {field.label}
                  {field.required ? ' *' : ''}
                </span>
                <select
                  value={columnMapping[field.key] || ''}
                  onChange={(e) =>
                    setColumnMapping((m) => ({ ...m, [field.key]: e.target.value || null }))
                  }
                  className="flex-1 min-w-[140px] rounded-lg border border-white/15 bg-black/30 px-2 py-1.5 text-sm"
                >
                  {fieldOptions.map((opt) => (
                    <option key={opt.value || 'skip'} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStep('upload')}
              className="rounded-xl border border-white/15 px-4 py-2 text-sm text-white/70 hover:bg-white/5"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={onMappingNext}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-[#39FF14] px-4 py-2 text-sm font-bold text-[#050508] hover:brightness-110 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Validar dados
            </button>
          </div>
        </div>
      ) : null}

      {step === 'preview' && validation ? (
        <div className="space-y-4">
          {insights ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
              <p className="text-xs font-semibold text-amber-200 m-0 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                Análise imediata
              </p>
              <p className="text-sm text-amber-100/90 mt-1 m-0">{insights.mensagem}</p>
              <p className="text-xs text-amber-200/70 mt-1 m-0">
                Capital estimado: {formatBrl(insights.capital_total_estimado)} ·{' '}
                {insights.pct_capital_parado}% em possível baixo giro
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 px-2.5 py-1">
              {validation.summary.valid} válidas
            </span>
            {validation.summary.errors > 0 ? (
              <span className="rounded-full bg-red-500/15 border border-red-500/30 text-red-200 px-2.5 py-1">
                {validation.summary.errors} com erro
              </span>
            ) : null}
            {validation.suggested_categories?.length ? (
              <span className="rounded-full bg-white/5 border border-white/15 text-white/60 px-2.5 py-1">
                {validation.suggested_categories.length} categorias novas
              </span>
            ) : null}
          </div>

          {validation.error_rows?.length > 0 ? (
            <div className="rounded-xl border border-red-500/25 bg-red-500/5 p-3 max-h-32 overflow-y-auto">
              <p className="text-xs font-semibold text-red-300 m-0 mb-2">Erros (corrija no CSV ou mapeamento)</p>
              <ul className="text-[11px] text-red-200/90 space-y-1 list-disc pl-4 m-0">
                {validation.error_rows.slice(0, 8).map((row) => (
                  <li key={row.row}>
                    Linha {row.row}: {row.errors.join(' ')}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="text-[11px] text-white/45 m-0">
            Itens entram como <strong className="text-white/70">Pendente de revisão</strong> — confira custos médios antes de ativar.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStep('mapping')}
              className="rounded-xl border border-white/15 px-4 py-2 text-sm text-white/70 hover:bg-white/5"
            >
              Ajustar mapeamento
            </button>
            <button
              type="button"
              onClick={onConfirmImport}
              disabled={loading || !validation.valid_rows?.length}
              className="inline-flex items-center gap-2 rounded-xl bg-[#39FF14] px-4 py-2 text-sm font-bold text-[#050508] hover:brightness-110 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Importar {validation.valid_rows?.length} itens (pendente)
            </button>
          </div>
        </div>
      ) : null}

      {step === 'done' ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2" aria-hidden />
            <p className="text-sm font-semibold text-emerald-100 m-0">
              {importedCount} itens importados — pendente de revisão
            </p>
            {insights ? (
              <p className="text-xs text-emerald-200/80 mt-2 m-0">{insights.mensagem}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onApprove}
              disabled={loading}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#39FF14] px-4 py-2.5 text-sm font-bold text-[#050508] hover:brightness-110 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Aprovar e ativar estoque
            </button>
            <button
              type="button"
              onClick={() => {
                onConfirmed?.();
                onClose?.();
              }}
              className="rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white/70 hover:bg-white/5"
            >
              Revisar depois
            </button>
          </div>
        </div>
      ) : null}

      {pendingCount > 0 && step === 'upload' ? (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex items-center justify-between gap-3">
          <span className="text-xs text-amber-200 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            {pendingCount} insumo(s) aguardando revisão
          </span>
          <button
            type="button"
            onClick={onApprovePending}
            disabled={loading}
            className="text-xs font-semibold text-amber-100 underline hover:no-underline"
          >
            Aprovar todos
          </button>
        </div>
      ) : null}
    </div>
  );
}
