'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, PackagePlus, Search } from 'lucide-react';
import { painelApi } from '../../lib/merchant/painelApiPaths';

/**
 * Cadastro rápido quando o EAN não existe em insumos_loja.
 */
export function StockScanUnknownModal({ ean, direction, onCreated, onClose }) {
  const [nome, setNome] = useState('');
  const [quantidade, setQuantidade] = useState('1');
  const [lookup, setLookup] = useState({ status: 'idle', product: null, error: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!ean) return undefined;

    const ac = new AbortController();
    setLookup({ status: 'loading', product: null, error: '' });

    (async () => {
      try {
        const url = `${painelApi.cosmosBarcodeLookup}?gtin=${encodeURIComponent(ean)}`;
        const res = await fetch(url, {
          credentials: 'include',
          signal: ac.signal,
        });
        const data = await res.json().catch(() => ({}));

        if (res.status === 404) {
          setLookup({ status: 'not_found', product: null, error: '' });
          return;
        }
        if (!res.ok) {
          throw new Error(data.error || 'Não foi possível consultar o Cosmos.');
        }

        const product = data.product || null;
        setLookup({ status: 'found', product, error: '' });
        if (product?.name) {
          setNome((prev) => (prev.trim() ? prev : product.name));
        }
      } catch (err) {
        if (err?.name === 'AbortError') return;
        setLookup({
          status: 'error',
          product: null,
          error: err?.message || 'Não foi possível consultar o Cosmos.',
        });
      }
    })();

    return () => ac.abort();
  }, [ean]);

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
          imagem_url: lookup.product?.imageUrl || null,
          imagem_source: lookup.product?.source || 'cosmos_gtin',
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

        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
          {lookup.status === 'loading' ? (
            <p className="m-0 flex items-center gap-2 text-xs text-white/60">
              <Search className="h-3.5 w-3.5 animate-pulse text-[#39FF14]" aria-hidden />
              Consultando cadastro do produto no Cosmos…
            </p>
          ) : lookup.product ? (
            <div className="flex items-center gap-3">
              {lookup.product.imageUrl ? (
                <img
                  src={lookup.product.imageUrl}
                  alt=""
                  className="h-12 w-12 rounded-lg bg-white object-contain p-1"
                />
              ) : null}
              <div className="min-w-0">
                <p className="m-0 flex items-center gap-1.5 text-xs font-semibold text-[#39FF14]">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  Encontrado no Cosmos
                </p>
                <p className="m-0 mt-1 truncate text-sm text-white/90">{lookup.product.name}</p>
                {lookup.product.brand ? (
                  <p className="m-0 mt-0.5 truncate text-xs text-white/45">{lookup.product.brand}</p>
                ) : null}
              </div>
            </div>
          ) : lookup.error ? (
            <p className="m-0 text-xs text-amber-200/80">{lookup.error}</p>
          ) : (
            <p className="m-0 text-xs text-white/45">Sem cadastro encontrado no Cosmos para este EAN.</p>
          )}
        </div>

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
