'use client';

import { useState } from 'react';
import { Loader2, PackagePlus } from 'lucide-react';
import { painelApi } from '../../lib/merchant/painelApiPaths';

/**
 * Cadastro rápido quando o EAN não existe em insumos_loja.
 */
export function StockScanUnknownModal({ ean, direction, onCreated, onClose }) {
  const [nome, setNome] = useState('');
  const [quantidade, setQuantidade] = useState('1');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    const trimmed = nome.trim();
    if (trimmed.length < 2) {
      setError('Informe o nome do produto.');
      return;
    }
    const qty = parseFloat(String(quantidade).replace(',', '.'));
    const baseQty = Number.isFinite(qty) && qty >= 0 ? qty : 1;
    const quantidadeAtual = direction === 'out' ? 0 : baseQty;

    setSaving(true);
    setError('');
    try {
      const res = await fetch(painelApi.insumos, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          nome: trimmed,
          ean,
          quantidade_atual: quantidadeAtual,
          unidade: 'un',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Erro ao cadastrar.');
      onCreated?.(data.insumo);
      onClose?.();
    } catch (err) {
      setError(err?.message || 'Erro de rede');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70">
      <div
        className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0a0a0f] p-5 shadow-xl"
        role="dialog"
        aria-labelledby="unknown-product-title"
      >
        <h2 id="unknown-product-title" className="text-lg font-bold text-white m-0 flex items-center gap-2">
          <PackagePlus className="h-5 w-5 text-[#39FF14]" aria-hidden />
          Produto não cadastrado
        </h2>
        <p className="text-sm text-white/60 mt-2 m-0">
          EAN <span className="font-mono text-white/90">{ean}</span> não está no estoque. Cadastre para continuar.
        </p>

        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <label className="block text-xs text-white/50">
            Nome do insumo
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white"
              autoFocus
              maxLength={200}
            />
          </label>
          {direction === 'in' ? (
            <label className="block text-xs text-white/50">
              Quantidade inicial
              <input
                type="text"
                inputMode="decimal"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white"
              />
            </label>
          ) : null}
          {error ? (
            <p className="text-sm text-red-400 m-0" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-white/20 py-2.5 text-sm text-white/80 hover:bg-white/5"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#39FF14] py-2.5 text-sm font-bold text-[#050508] disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Cadastrar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
