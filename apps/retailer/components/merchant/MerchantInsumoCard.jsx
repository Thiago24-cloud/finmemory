'use client';

import { useRef, useState } from 'react';
import { Camera, Loader2, Trash2, AlertTriangle, ShoppingCart, RefreshCw } from 'lucide-react';
import { painelApi } from '../../lib/merchant/painelApiPaths';
import { InsumoProductImage } from './InsumoProductImage';

const UNIDADE_LABEL = {
  un: 'un',
  kg: 'kg',
  g: 'g',
  L: 'L',
  ml: 'ml',
  cx: 'cx',
  pct: 'pct',
  dz: 'dz',
};

function formatBrl(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));
}

function formatQty(value, unidade) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const label = UNIDADE_LABEL[unidade] || unidade || 'un';
  return `${n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ${label}`;
}

export function MerchantInsumoCard({ insumo, onUpdated, onRemoved }) {
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef(null);

  const uploadPhoto = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const reader = new FileReader();
      const imageBase64 = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const uploadRes = await fetch(painelApi.insumoUploadImage, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, insumoId: insumo.id }),
      });
      const uploadJson = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok) {
        alert(uploadJson.error || 'Não foi possível enviar a foto.');
        return;
      }

      const patchRes = await fetch(painelApi.insumo(insumo.id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imagem_url: uploadJson.url,
          imagem_source: 'custom',
        }),
      });
      const patchJson = await patchRes.json().catch(() => ({}));
      if (!patchRes.ok) {
        alert(patchJson.error || 'Foto enviada, mas não foi possível salvar no estoque.');
        return;
      }
      onUpdated?.(patchJson.insumo);
    } catch {
      alert('Erro ao enviar foto.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Remover "${insumo.nome}" da lista de insumos?`)) return;
    setBusy(true);
    try {
      const res = await fetch(painelApi.insumo(insumo.id), { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'Não foi possível remover.');
        return;
      }
      onRemoved?.(insumo.id);
    } catch {
      alert('Erro de rede.');
    } finally {
      setBusy(false);
    }
  };

  const addToCesta = async () => {
    setBusy(true);
    try {
      const res = await fetch(painelApi.comprasCesta, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', insumoId: insumo.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'Não foi possível adicionar à cesta.');
        return;
      }
      onUpdated?.({ ...insumo, na_cesta: true });
    } catch {
      alert('Erro de rede.');
    } finally {
      setBusy(false);
    }
  };

  const retryImage = async () => {
    setBusy(true);
    try {
      const res = await fetch(painelApi.insumoResolveImage(insumo.id), { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'Não foi possível buscar imagem.');
        return;
      }
      onUpdated?.(data.insumo);
    } catch {
      alert('Erro de rede.');
    } finally {
      setBusy(false);
    }
  };

  const toggleRecorrente = async () => {
    setBusy(true);
    try {
      const res = await fetch(painelApi.insumo(insumo.id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recorrente: !insumo.recorrente }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'Erro ao atualizar.');
        return;
      }
      onUpdated?.(data.insumo);
    } catch {
      alert('Erro de rede.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <li
      className={`rounded-xl border p-3 sm:p-4 ${
        insumo.abaixo_minimo
          ? 'border-amber-500/40 bg-amber-500/5'
          : 'border-white/10 bg-white/[0.03]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white p-1.5 shadow-sm">
          <InsumoProductImage insumo={insumo} className="h-full w-full" iconClassName="h-7 w-7" />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              void uploadPhoto(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
            className="absolute bottom-0.5 right-0.5 rounded-full bg-[#39FF14] p-1 text-black shadow"
            title="Tirar foto ou enviar imagem"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold m-0 truncate">{insumo.nome}</h3>
            {insumo.recorrente ? (
              <span className="text-[10px] uppercase tracking-wide text-[#39FF14]/80 bg-[#39FF14]/10 border border-[#39FF14]/25 px-2 py-0.5 rounded-full">
                Recorrente
              </span>
            ) : null}
            {insumo.abaixo_minimo ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-amber-200 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
                <AlertTriangle className="h-3 w-3" aria-hidden />
                Abaixo do mínimo
              </span>
            ) : null}
          </div>
          <dl className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs m-0">
            <div>
              <dt className="text-white/45 m-0">Em estoque</dt>
              <dd className="text-white/90 font-medium m-0 mt-0.5">
                {formatQty(insumo.quantidade_atual, insumo.unidade)}
              </dd>
            </div>
            <div>
              <dt className="text-white/45 m-0">Mínimo</dt>
              <dd className="text-white/90 font-medium m-0 mt-0.5">
                {formatQty(insumo.estoque_minimo, insumo.unidade)}
              </dd>
            </div>
            <div>
              <dt className="text-white/45 m-0">Custo médio</dt>
              <dd className="text-white/90 font-medium m-0 mt-0.5">{formatBrl(insumo.custo_medio)}</dd>
            </div>
            <div>
              <dt className="text-white/45 m-0">Código</dt>
              <dd className="text-white/70 font-mono text-[11px] m-0 mt-0.5 truncate">
                {insumo.ean || '—'}
              </dd>
            </div>
          </dl>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          {!insumo.na_cesta ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void addToCesta()}
              className="inline-flex items-center justify-center gap-1 text-[10px] text-[#39FF14] hover:bg-[#39FF14]/10 px-2 py-1 rounded border border-[#39FF14]/25"
            >
              <ShoppingCart className="h-3 w-3" aria-hidden />
              Na cesta
            </button>
          ) : (
            <span className="text-[10px] text-[#39FF14]/80 px-2 py-1 text-center">Na cesta</span>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => void retryImage()}
            className="inline-flex items-center justify-center gap-1 text-[10px] text-white/55 hover:text-[#39FF14] px-2 py-1 rounded border border-white/10"
            title="Buscar imagem (Cosmos / Open Food Facts)"
          >
            <RefreshCw className={`h-3 w-3 ${busy ? 'animate-spin' : ''}`} aria-hidden />
            Imagem auto
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void toggleRecorrente()}
            className="text-[10px] text-white/50 hover:text-white/80 px-2 py-1 rounded border border-white/10"
          >
            {insumo.recorrente ? 'Não recorrente' : 'Marcar recorrente'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void remove()}
            className="inline-flex items-center justify-center gap-1 text-[10px] text-red-300 hover:bg-red-500/10 px-2 py-1 rounded border border-red-500/20"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <Trash2 className="h-3 w-3" aria-hidden />}
            Remover
          </button>
        </div>
      </div>
    </li>
  );
}
