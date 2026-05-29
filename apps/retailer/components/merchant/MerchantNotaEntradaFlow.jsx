'use client';

import { useCallback, useRef, useState } from 'react';
import { Camera, Loader2, FileText, QrCode, CheckCircle2, X } from 'lucide-react';
import { painelApi } from '../../lib/merchant/painelApiPaths';

async function compressImage(file, maxSizeMB = 1.5) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        const maxDimension = 2000;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height / width) * maxDimension;
            width = maxDimension;
          } else {
            width = (width / height) * maxDimension;
            height = maxDimension;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        let quality = 0.82;
        let base64 = canvas.toDataURL('image/jpeg', quality);
        while (base64.length > maxSizeMB * 1024 * 1024 * 1.37 && quality > 0.1) {
          quality -= 0.1;
          base64 = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(base64);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function emptyDraft() {
  return {
    fornecedor: '',
    valor_total: '',
    chave_nfe: '',
    imagem_url: '',
    nfce_url: '',
    itens: [],
  };
}

/**
 * @param {{ insumos: object[], onConfirmed: () => void, onClose: () => void }} props
 */
export function MerchantNotaEntradaFlow({ insumos = [], onConfirmed, onClose }) {
  const fileRef = useRef(null);
  const [step, setStep] = useState('capture');
  const [error, setError] = useState('');
  const [qrInput, setQrInput] = useState('');
  const [draft, setDraft] = useState(emptyDraft);

  const processPhoto = async (file) => {
    setStep('processing');
    setError('');
    try {
      const imageBase64 = await compressImage(file);
      const res = await fetch(painelApi.notasEntradaProcessImage, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, fileName: file.name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Não foi possível ler a nota.');
        setStep('capture');
        return;
      }
      applyDraft(data.draft);
      setStep('review');
    } catch {
      setError('Erro de rede ao processar foto.');
      setStep('capture');
    }
  };

  const fetchQr = async () => {
    if (!qrInput.trim()) {
      setError('Cole o link ou conteúdo do QR da NFC-e.');
      return;
    }
    setStep('processing');
    setError('');
    try {
      const res = await fetch(painelApi.notasEntradaFetchNfce, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrContent: qrInput.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Não foi possível consultar a NFC-e.');
        setStep('capture');
        return;
      }
      if (data.message) setError(data.message);
      applyDraft(data.draft);
      setStep('review');
    } catch {
      setError('Erro de rede ao consultar NFC-e.');
      setStep('capture');
    }
  };

  const applyDraft = useCallback((incoming) => {
    setDraft({
      fornecedor: incoming.fornecedor || '',
      valor_total: incoming.valor_total != null ? String(incoming.valor_total) : '',
      chave_nfe: incoming.chave_nfe || '',
      imagem_url: incoming.imagem_url || '',
      nfce_url: incoming.nfce_url || '',
      itens: (incoming.itens || []).map((item, idx) => ({
        ...item,
        key: `item-${idx}`,
        criar_insumo: item.criar_insumo !== false && !item.insumo_id,
      })),
    });
  }, []);

  const updateItem = (index, patch) => {
    setDraft((prev) => {
      const itens = [...prev.itens];
      const current = { ...itens[index], ...patch };
      if (patch.insumo_id !== undefined) {
        current.criar_insumo = !patch.insumo_id;
      }
      if (patch.criar_insumo === true) {
        current.insumo_id = null;
      }
      itens[index] = current;
      return { ...prev, itens };
    });
  };

  const confirm = async () => {
    setStep('saving');
    setError('');
    try {
      const valorTotal =
        draft.valor_total === '' ? null : parseFloat(String(draft.valor_total).replace(',', '.'));
      const res = await fetch(painelApi.notasEntradaConfirm, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fornecedor: draft.fornecedor,
          chave_nfe: draft.chave_nfe || null,
          valor_total: valorTotal,
          imagem_url: draft.imagem_url || null,
          itens: draft.itens.map((item) => ({
            nome: item.nome,
            ean: item.ean,
            quantidade: parseFloat(String(item.quantidade).replace(',', '.')) || 1,
            preco_unitario:
              item.preco_unitario === '' || item.preco_unitario == null
                ? null
                : parseFloat(String(item.preco_unitario).replace(',', '.')),
            insumo_id: item.criar_insumo ? null : item.insumo_id,
            criar_insumo: Boolean(item.criar_insumo),
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Erro ao confirmar entrada.');
        setStep('review');
        return;
      }
      setStep('success');
      onConfirmed?.(data);
    } catch {
      setError('Erro de rede ao salvar.');
      setStep('review');
    }
  };

  if (step === 'success') {
    return (
      <div className="rounded-2xl border border-[#39FF14]/30 bg-[#39FF14]/10 p-6 text-center">
        <CheckCircle2 className="h-12 w-12 text-[#39FF14] mx-auto mb-3" aria-hidden />
        <h3 className="text-lg font-bold m-0">Entrada registrada</h3>
        <p className="text-sm text-white/70 mt-2 m-0">O estoque dos insumos foi atualizado.</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 rounded-xl bg-[#39FF14] px-6 py-2.5 text-sm font-bold text-[#050508]"
        >
          Fechar
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold m-0 flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#39FF14]" aria-hidden />
            Entrada por nota fiscal
          </h3>
          <p className="text-xs text-white/50 mt-1 m-0">Foto ou QR da NFC-e → revise → confirma no estoque.</p>
        </div>
        <button type="button" onClick={onClose} className="text-white/40 hover:text-white p-1" aria-label="Fechar">
          <X className="h-5 w-5" />
        </button>
      </div>

      {error ? (
        <p className="text-sm text-amber-200/90 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2 m-0" role="alert">
          {error}
        </p>
      ) : null}

      {step === 'capture' ? (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void processPhoto(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-[#39FF14]/40 bg-[#39FF14]/10 py-4 text-sm font-semibold text-[#39FF14] hover:bg-[#39FF14]/15"
          >
            <Camera className="h-5 w-5" aria-hidden />
            Tirar foto ou escolher imagem da nota
          </button>

          <div className="relative py-2 text-center text-[11px] text-white/35">ou</div>

          <label className="block">
            <span className="text-xs font-medium text-white/70 mb-1 flex items-center gap-1">
              <QrCode className="h-3.5 w-3.5" aria-hidden />
              Link / QR da NFC-e
            </span>
            <textarea
              value={qrInput}
              onChange={(e) => setQrInput(e.target.value)}
              rows={3}
              placeholder="Cole aqui o link da consulta ou o conteúdo do QR code"
              className="w-full rounded-xl border border-white/15 bg-[#0a0a10] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#39FF14]/40"
            />
          </label>
          <button
            type="button"
            onClick={() => void fetchQr()}
            className="w-full rounded-xl border border-white/20 py-3 text-sm font-medium text-white/80 hover:bg-white/5"
          >
            Buscar dados da NFC-e
          </button>
        </>
      ) : null}

      {step === 'processing' ? (
        <div className="flex flex-col items-center py-10 gap-3 text-white/60">
          <Loader2 className="h-8 w-8 animate-spin text-[#39FF14]" aria-hidden />
          <p className="text-sm m-0">Lendo nota fiscal…</p>
        </div>
      ) : null}

      {step === 'review' || step === 'saving' ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block sm:col-span-2">
              <span className="text-xs text-white/60 mb-1 block">Fornecedor / mercado</span>
              <input
                value={draft.fornecedor}
                onChange={(e) => setDraft((d) => ({ ...d, fornecedor: e.target.value }))}
                className="w-full rounded-lg border border-white/15 bg-[#0a0a10] px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs text-white/60 mb-1 block">Valor total (R$)</span>
              <input
                value={draft.valor_total}
                onChange={(e) => setDraft((d) => ({ ...d, valor_total: e.target.value }))}
                inputMode="decimal"
                className="w-full rounded-lg border border-white/15 bg-[#0a0a10] px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs text-white/60 mb-1 block">Chave NF-e (44 dígitos)</span>
              <input
                value={draft.chave_nfe}
                onChange={(e) => setDraft((d) => ({ ...d, chave_nfe: e.target.value.replace(/\D/g, '').slice(0, 44) }))}
                inputMode="numeric"
                className="w-full rounded-lg border border-white/15 bg-[#0a0a10] px-3 py-2 text-sm font-mono text-xs"
              />
            </label>
          </div>

          <p className="text-xs font-semibold text-white/70 m-0">Itens — vincule ao insumo ou crie novo</p>
          <ul className="space-y-3 list-none p-0 m-0 max-h-[340px] overflow-y-auto pr-1">
            {draft.itens.map((item, idx) => (
              <li key={item.key || idx} className="rounded-xl border border-white/10 bg-[#0a0a10] p-3 space-y-2">
                <input
                  value={item.nome}
                  onChange={(e) => updateItem(idx, { nome: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-transparent px-2 py-1.5 text-sm font-medium"
                />
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[11px] text-white/50">
                    Qtd
                    <input
                      value={item.quantidade}
                      onChange={(e) => updateItem(idx, { quantidade: e.target.value })}
                      inputMode="decimal"
                      className="mt-0.5 w-full rounded border border-white/10 bg-transparent px-2 py-1 text-sm"
                    />
                  </label>
                  <label className="text-[11px] text-white/50">
                    Preço un. (R$)
                    <input
                      value={item.preco_unitario ?? ''}
                      onChange={(e) => updateItem(idx, { preco_unitario: e.target.value })}
                      inputMode="decimal"
                      className="mt-0.5 w-full rounded border border-white/10 bg-transparent px-2 py-1 text-sm"
                    />
                  </label>
                </div>
                <label className="block text-[11px] text-white/50">
                  Vincular ao insumo
                  <select
                    value={item.criar_insumo ? '' : item.insumo_id || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) updateItem(idx, { insumo_id: null, criar_insumo: true });
                      else updateItem(idx, { insumo_id: val, criar_insumo: false });
                    }}
                    className="mt-0.5 w-full rounded border border-white/10 bg-[#0a0a10] px-2 py-1.5 text-sm text-white"
                  >
                    <option value="">+ Criar novo insumo</option>
                    {insumos.map((ins) => (
                      <option key={ins.id} value={ins.id}>
                        {ins.nome}
                      </option>
                    ))}
                  </select>
                </label>
                {item.sugestao_label && !item.insumo_id && item.criar_insumo ? (
                  <button
                    type="button"
                    onClick={() => updateItem(idx, { insumo_id: item.sugestao_insumo_id, criar_insumo: false })}
                    className="text-[11px] text-[#39FF14] hover:underline"
                  >
                    Usar sugestão: {item.sugestao_label}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              disabled={step === 'saving'}
              onClick={() => void confirm()}
              className="inline-flex items-center gap-2 rounded-xl bg-[#39FF14] px-5 py-2.5 text-sm font-bold text-[#050508] disabled:opacity-60"
            >
              {step === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Confirmar entrada no estoque
            </button>
            <button
              type="button"
              disabled={step === 'saving'}
              onClick={() => {
                setDraft(emptyDraft());
                setStep('capture');
                setError('');
              }}
              className="rounded-xl border border-white/20 px-4 py-2.5 text-sm text-white/70"
            >
              Voltar
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
