'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowDownCircle, ArrowUpCircle, Barcode, ScanEye } from 'lucide-react';
import { painelApi } from '../../lib/merchant/painelApiPaths';
import { StockBarcodeScanner } from './StockBarcodeScanner';
import { StockScanUnknownModal } from './StockScanUnknownModal';
import { useStockBarcodeScanner } from '../../hooks/useStockBarcodeScanner';
import { VisionStockScanner } from './vision/VisionStockScanner';

function formatQty(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

export function StockCameraClient() {
  const [direction, setDirection] = useState('in');
  const [mode, setMode] = useState('barcode');
  const [unknownEan, setUnknownEan] = useState(null);
  const [lojaId, setLojaId] = useState(null);

  const scanner = useStockBarcodeScanner({
    direction,
    delta: 1,
    onUnknownProduct: (ean) => setUnknownEan(ean),
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(painelApi.context, { credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok) setLojaId(data.store?.id || null);
      } catch {
        /* contexto opcional para cache visão */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#050508] text-white">
      <div className="mx-auto max-w-lg px-4 py-5">
        <Link
          href="/parceiros/painel"
          className="inline-flex items-center gap-2 text-sm text-white/55 hover:text-[#39FF14] mb-4"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Voltar ao painel
        </Link>

        <h1 className="text-xl font-bold m-0">Estoque por câmera</h1>
        <p className="text-sm text-white/55 mt-1 mb-4 m-0">
          {mode === 'barcode'
            ? 'Bipe o código de barras para entrada ou saída instantânea.'
            : 'Aponte para o produto — detecção local (verde) ou nuvem (âmbar).'}
        </p>

        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => setMode('barcode')}
            className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold border transition ${
              mode === 'barcode'
                ? 'bg-white/10 border-white/30 text-white'
                : 'border-white/15 text-white/60 hover:bg-white/5'
            }`}
          >
            <Barcode className="h-4 w-4" aria-hidden />
            Código de barras
          </button>
          <button
            type="button"
            onClick={() => setMode('vision')}
            className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold border transition ${
              mode === 'vision'
                ? 'bg-white/10 border-white/30 text-white'
                : 'border-white/15 text-white/60 hover:bg-white/5'
            }`}
          >
            <ScanEye className="h-4 w-4" aria-hidden />
            Visão IA
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setDirection('in')}
            className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold border transition ${
              direction === 'in'
                ? 'bg-[#39FF14]/15 border-[#39FF14]/50 text-[#39FF14]'
                : 'border-white/15 text-white/70 hover:bg-white/5'
            }`}
          >
            <ArrowDownCircle className="h-4 w-4" aria-hidden />
            Entrada
          </button>
          <button
            type="button"
            onClick={() => setDirection('out')}
            className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold border transition ${
              direction === 'out'
                ? 'bg-amber-500/15 border-amber-400/50 text-amber-200'
                : 'border-white/15 text-white/70 hover:bg-white/5'
            }`}
          >
            <ArrowUpCircle className="h-4 w-4" aria-hidden />
            Saída
          </button>
        </div>

        {mode === 'barcode' ? (
          <>
            <StockBarcodeScanner onScan={scanner.handleScan} overlay={scanner.overlay} />

            {scanner.lastError ? (
              <p className="text-sm text-red-400 mt-3 m-0" role="alert">
                {scanner.lastError}
              </p>
            ) : null}

            {scanner.recent.length > 0 ? (
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <h2 className="text-xs font-bold uppercase tracking-wide text-white/45 m-0 mb-3">
                  Últimas leituras
                </h2>
                <ul className="space-y-2 list-none p-0 m-0">
                  {scanner.recent.map((row) => (
                    <li
                      key={row.id}
                      className="flex items-center justify-between gap-2 text-sm border-b border-white/5 pb-2 last:border-0 last:pb-0"
                    >
                      <span className="truncate text-white/90">{row.nome}</span>
                      <span className="shrink-0 text-[#39FF14] font-medium">
                        {row.appliedDelta > 0 ? '+' : ''}
                        {formatQty(row.appliedDelta)} → {formatQty(row.quantidade_atual)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : lojaId ? (
          <VisionStockScanner
            direction={direction}
            lojaId={lojaId}
            onUnknownEan={(ean) => setUnknownEan(ean)}
          />
        ) : (
          <p className="text-sm text-white/50 m-0">Carregando loja…</p>
        )}
      </div>

      {unknownEan && mode === 'barcode' ? (
        <StockScanUnknownModal
          ean={unknownEan}
          direction={direction}
          onCreated={() => {
            const ean = unknownEan;
            setUnknownEan(null);
            void scanner.handleScan(ean);
          }}
          onClose={() => setUnknownEan(null)}
        />
      ) : null}
    </div>
  );
}
