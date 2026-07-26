'use client';

import { useRef, useState } from 'react';
import { Camera, CheckCircle2, ChevronRight, Loader2, Settings } from 'lucide-react';
import { useBridgeContext } from './BridgeContext';
import { fmtCurrency } from '../../../lib/adm/bridgeFormat';

export function BridgeNotaEntrada({ onGoValidar }) {
  const { selectedMerchant } = useBridgeContext();
  const fileInputRef = useRef(null);
  const [flow, setFlow] = useState('capture');
  const [draft, setDraft] = useState(null);
  const [items, setItems] = useState([]);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');

  if (!selectedMerchant) {
    return <p className="text-sm text-muted-foreground">Selecione um comerciante para registrar nota.</p>;
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr('');
    setFlow('processing');

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = String(ev.target?.result || '');
      const base64Data = base64.split(',')[1];
      try {
        const res = await fetch('/api/parceiros/adm/bridge/notas-entrada/process-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            store_id: selectedMerchant.store_id,
            imageBase64: base64Data,
            fileName: file.name,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Falha no OCR');
        setDraft(data.draft);
        setItems(data.draft.itens || []);
        setFlow('review');
      } catch (ex) {
        setErr(ex.message);
        setFlow('capture');
      }
    };
    reader.readAsDataURL(file);
  }

  function updateItem(idx, field, value) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  }

  async function confirm() {
    if (!draft) return;
    setFlow('processing');
    setErr('');
    try {
      const res = await fetch('/api/parceiros/adm/bridge/notas-entrada/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: selectedMerchant.store_id,
          fornecedor: draft.fornecedor,
          chave_nfe: draft.chave_nfe,
          valor_total: draft.valor_total,
          imagem_url: draft.imagem_url,
          itens: items.map((item) => ({
            nome: item.nome,
            quantidade: item.quantidade,
            preco_unitario: item.preco_unitario,
            insumo_id: item.insumo_id || item.sugestao_insumo_id || null,
            criar_insumo: item.criar_insumo || false,
            unidade: item.unidade || 'un',
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha na confirmação');
      setResult(data);
      setFlow('success');
    } catch (ex) {
      setErr(ex.message);
      setFlow('review');
    }
  }

  function reset() {
    setDraft(null);
    setItems([]);
    setResult(null);
    setFlow('capture');
    setErr('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Entrada de Nota Fiscal</h2>
        <p className="text-muted-foreground">
          Digitalize NFC-e/NF-e para abastecer o estoque de {selectedMerchant.store_name}.
        </p>
      </div>

      {err ? <p className="text-sm text-destructive">{err}</p> : null}

      {flow === 'capture' && (
        <div className="rounded-xl border-2 border-dashed border-border bg-muted/20 p-12 text-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Camera className="w-10 h-10 text-primary" />
          </div>
          <h3 className="text-xl font-bold mb-2">Capturar Nota</h3>
          <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
            Tire uma foto ou faça upload da nota fiscal. A IA extrai os itens automaticamente.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFile}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground"
          >
            <Camera className="w-4 h-4 inline mr-2" /> Abrir Câmera / Upload
          </button>
        </div>
      )}

      {flow === 'processing' && (
        <div className="rounded-xl border border-border bg-card p-16 text-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <h3 className="text-xl font-bold">Processando Documento…</h3>
          <p className="text-muted-foreground mt-2">Extraindo fornecedor, valores e itens.</p>
        </div>
      )}

      {flow === 'review' && draft && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/30 flex justify-between items-start">
            <div>
              <h3 className="text-xl font-bold">{draft.fornecedor}</h3>
              <p className="text-sm text-muted-foreground">{items.length} itens encontrados</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-2xl font-bold">{fmtCurrency(draft.valor_total)}</p>
            </div>
          </div>
          <div className="divide-y divide-border">
            {items.map((item, idx) => (
              <div key={idx} className="p-4 space-y-3">
                <input
                  className="w-full font-medium rounded border border-border px-2 py-1"
                  value={item.nome}
                  onChange={(e) => updateItem(idx, 'nome', e.target.value)}
                />
                {item.sugestao_label ? (
                  <p className="text-xs text-green-600 flex items-center">
                    <Settings className="w-3 h-3 mr-1" /> Mapeado: {item.sugestao_label}
                  </p>
                ) : null}
                <div className="flex gap-3">
                  <label className="text-xs">
                    Qtd
                    <input
                      type="number"
                      step="0.01"
                      className="block w-20 mt-1 rounded border border-border px-2 py-1 text-sm"
                      value={item.quantidade}
                      onChange={(e) => updateItem(idx, 'quantidade', Number(e.target.value))}
                    />
                  </label>
                  <label className="text-xs">
                    Un. (R$)
                    <input
                      type="number"
                      step="0.01"
                      className="block w-24 mt-1 rounded border border-border px-2 py-1 text-sm"
                      value={item.preco_unitario}
                      onChange={(e) => updateItem(idx, 'preco_unitario', Number(e.target.value))}
                    />
                  </label>
                  {!item.sugestao_insumo_id && (
                    <label className="text-xs flex items-end gap-2 pb-1">
                      <input
                        type="checkbox"
                        checked={Boolean(item.criar_insumo)}
                        onChange={(e) => updateItem(idx, 'criar_insumo', e.target.checked)}
                      />
                      Novo insumo
                    </label>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 flex gap-3 border-t border-border">
            <button type="button" onClick={reset} className="flex-1 rounded-lg border border-border py-2 text-sm">
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirm}
              className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground"
            >
              Confirmar Estoque <ChevronRight className="w-4 h-4 inline" />
            </button>
          </div>
        </div>
      )}

      {flow === 'success' && result && (
        <div className="rounded-xl border border-green-200 bg-green-50/30 p-12 text-center">
          <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h3 className="text-2xl font-bold mb-2">Estoque Atualizado!</h3>
          <p className="text-muted-foreground mb-6">{result.message}</p>
          {result.consumer_export ? (
            <p className="text-xs text-muted-foreground mb-6">
              Sincronização ERP Consumer concluída (mock).
            </p>
          ) : null}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button type="button" onClick={reset} className="rounded-lg border border-border px-4 py-2 text-sm">
              Nova Leitura
            </button>
            {onGoValidar ? (
              <button
                type="button"
                onClick={onGoValidar}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                Ir para Validações
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
