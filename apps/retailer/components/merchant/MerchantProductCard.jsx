'use client';

import { useState } from 'react';
import { Loader2, RefreshCw, Zap } from 'lucide-react';
import { painelApi } from '../../lib/merchant/painelApiPaths';
import { InsumoProductImage } from './InsumoProductImage';

function formatBrl(value) {
  return Number(value).toFixed(2).replace('.', ',');
}

export function MerchantProductCard({ product, onUpdated }) {
  const [busy, setBusy] = useState(false);
  const [priceEdit, setPriceEdit] = useState(String(product.price ?? ''));
  const [editingPrice, setEditingPrice] = useState(false);

  const imageInsumo = {
    nome: product.name,
    categoria: product.categoria,
    imagem_url: product.image_optimized_url || product.image_url || product.url_imagem,
    imagem_source: product.imagem_source,
  };

  const patch = async (body) => {
    setBusy(true);
    try {
      const res = await fetch(painelApi.product(product.id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'Não foi possível atualizar.');
        return;
      }
      onUpdated?.(data.product);
    } catch {
      alert('Erro de rede.');
    } finally {
      setBusy(false);
    }
  };

  const savePrice = async () => {
    const preco = parseFloat(String(priceEdit).replace(',', '.'));
    if (!Number.isFinite(preco) || preco < 0) {
      alert('Preço inválido.');
      return;
    }
    await patch({ price: preco, publishToMap: product.em_oferta });
    setEditingPrice(false);
  };

  const retryImage = async () => {
    setBusy(true);
    try {
      const res = await fetch(painelApi.productResolveImage(product.id), { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'Não foi possível buscar imagem.');
        return;
      }
      onUpdated?.(data.product);
    } catch {
      alert('Erro de rede.');
    } finally {
      setBusy(false);
    }
  };

  const showStrike =
    product.preco_original != null &&
    Number(product.preco_original) > Number(product.price);

  return (
    <li className="rounded-xl border border-border bg-card p-3 sm:p-4 flex gap-3 sm:gap-4 shadow-subtle">
      <div className="shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white border border-border overflow-hidden p-2">
        <InsumoProductImage insumo={imageInsumo} className="h-full w-full" iconClassName="h-6 w-6" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold m-0 truncate text-foreground">{product.name}</p>
          {product.em_oferta ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-primary bg-primary/15 px-2 py-0.5 rounded-full">
              <Zap className="h-3 w-3" aria-hidden />
              Relâmpago
            </span>
          ) : null}
          {product.status_disponivel === false || product.active === false ? (
            <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Indisponível</span>
          ) : null}
        </div>

        {product.description ? (
          <p className="text-xs text-muted-foreground mt-1 m-0 line-clamp-2">{product.description}</p>
        ) : null}

        <div className="mt-2 flex flex-wrap items-center gap-3">
          {editingPrice ? (
            <div className="flex items-center gap-2">
              <input
                value={priceEdit}
                onChange={(e) => setPriceEdit(e.target.value)}
                className="w-24 rounded-lg border border-input bg-background px-2 py-1 text-sm text-foreground"
                inputMode="decimal"
              />
              <button
                type="button"
                onClick={savePrice}
                disabled={busy}
                className="text-xs font-bold text-primary bg-transparent border-0 cursor-pointer"
              >
                OK
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingPrice(false);
                  setPriceEdit(String(product.price ?? ''));
                }}
                className="text-xs text-muted-foreground bg-transparent border-0 cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditingPrice(true)}
              className="text-left bg-transparent border-0 cursor-pointer p-0"
              disabled={busy}
            >
              {showStrike ? (
                <span className="text-xs text-muted-foreground line-through mr-2">
                  R$ {formatBrl(product.preco_original)}
                </span>
              ) : null}
              <span className="text-primary font-bold">R$ {formatBrl(product.price)}</span>
            </button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-4 text-xs">
          <button
            type="button"
            disabled={busy}
            onClick={() => void retryImage()}
            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors bg-transparent border-0 cursor-pointer p-0"
            title="Buscar imagem automaticamente"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} aria-hidden />
            Buscar imagem
          </button>
          <label className="inline-flex items-center gap-2 cursor-pointer text-foreground">
            <input
              type="checkbox"
              checked={Boolean(product.em_oferta)}
              disabled={busy}
              onChange={(e) =>
                patch({
                  em_oferta: e.target.checked,
                  publishToMap: e.target.checked,
                })
              }
              className="accent-primary"
            />
            Oferta no mapa
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer text-foreground">
            <input
              type="checkbox"
              checked={product.status_disponivel !== false && product.active !== false}
              disabled={busy}
              onChange={(e) => patch({ status_disponivel: e.target.checked })}
              className="accent-primary"
            />
            Disponível
          </label>
          {busy ? <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden /> : null}
        </div>
      </div>
    </li>
  );
}
