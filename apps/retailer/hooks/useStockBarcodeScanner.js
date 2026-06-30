'use client';

import { useCallback, useRef, useState } from 'react';
import { painelApi } from '../lib/merchant/painelApiPaths';

const DEBOUNCE_MS = 2000;

function playTone(type) {
  if (typeof window === 'undefined') return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = type === 'ok' ? 880 : 220;
    gain.gain.value = 0.08;
    osc.start();
    osc.stop(ctx.currentTime + (type === 'ok' ? 0.12 : 0.2));
    setTimeout(() => ctx.close().catch(() => {}), 300);
  } catch {
    /* sem áudio */
  }
  try {
    navigator.vibrate?.(type === 'ok' ? 40 : [30, 40, 30]);
  } catch {
    /* */
  }
}

/**
 * @param {{ direction: 'in' | 'out', delta?: number, onUnknownProduct?: (ean: string) => void }} opts
 */
export function useStockBarcodeScanner({ direction, delta = 1, onUnknownProduct }) {
  const [overlay, setOverlay] = useState('idle'); // idle | processing | success | error
  const [lastError, setLastError] = useState('');
  const [recent, setRecent] = useState([]);
  const lastByEan = useRef(new Map());
  const busyRef = useRef(false);

  const shouldAccept = useCallback((ean) => {
    const now = Date.now();
    const prev = lastByEan.current.get(ean) ?? 0;
    if (now - prev < DEBOUNCE_MS) return false;
    lastByEan.current.set(ean, now);
    return true;
  }, []);

  const pushRecent = useCallback((entry) => {
    setRecent((prev) => [entry, ...prev].slice(0, 8));
  }, []);

  const handleScan = useCallback(
    async (ean) => {
      const digits = String(ean || '').replace(/\D/g, '');
      if (!digits || !shouldAccept(digits)) return;
      if (busyRef.current) return;

      busyRef.current = true;
      setOverlay('processing');
      setLastError('');

      try {
        const res = await fetch(painelApi.estoqueScan, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ ean: digits, direction, delta }),
        });
        const data = await res.json().catch(() => ({}));

        if (res.status === 404 && data.code === 'product_not_found') {
          setOverlay('error');
          playTone('error');
          onUnknownProduct?.(digits);
          return;
        }

        if (!res.ok) {
          throw new Error(data.error || 'Falha ao atualizar estoque.');
        }

        setOverlay('success');
        playTone('ok');
        pushRecent({
          id: `${digits}-${Date.now()}`,
          ean: digits,
          nome: data.insumo?.nome || '—',
          quantidade_atual: data.insumo?.quantidade_atual,
          appliedDelta: data.appliedDelta,
          direction: data.direction,
          at: new Date().toISOString(),
        });

        window.setTimeout(() => setOverlay('idle'), 700);
      } catch (err) {
        setLastError(err?.message || 'Erro de rede');
        setOverlay('error');
        playTone('error');
        window.setTimeout(() => setOverlay('idle'), 1200);
      } finally {
        busyRef.current = false;
      }
    },
    [direction, delta, onUnknownProduct, pushRecent, shouldAccept]
  );

  return {
    overlay,
    lastError,
    recent,
    handleScan,
    clearError: () => setLastError(''),
  };
}
