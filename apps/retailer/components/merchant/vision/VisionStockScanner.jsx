'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { painelApi } from '../../../lib/merchant/painelApiPaths';
import {
  HybridDetector,
  stockLocalStore,
  DETECTION_DEBOUNCE_MS,
} from '../../../lib/vision';
import { CameraView } from './CameraView';
import { VisionDetectionOverlay } from './VisionDetectionOverlay';
import { StockScanUnknownModal } from '../StockScanUnknownModal';

function playFeedback(kind) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = kind === 'ok' ? 880 : 300;
    gain.gain.value = 0.07;
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
    setTimeout(() => ctx.close().catch(() => {}), 200);
    navigator.vibrate?.(kind === 'ok' ? 35 : [20, 30, 20]);
  } catch {
    /* */
  }
}

/**
 * Scanner de estoque por visão computacional (híbrido offline/online).
 */
export function VisionStockScanner({ direction, lojaId, onUnknownEan }) {
  const detectorRef = useRef(null);
  const busyRef = useRef(false);
  const lastByKey = useRef(new Map());
  const [phase, setPhase] = useState('idle');
  const [label, setLabel] = useState('');
  const [unknown, setUnknown] = useState(null);
  const [recent, setRecent] = useState([]);
  const [syncing, setSyncing] = useState(true);
  const [modelState, setModelState] = useState('loading');

  useEffect(() => {
    const detector = new HybridDetector();
    detectorRef.current = detector;
    void detector.init().then(async () => {
      const ready = await detector.local.isReady();
      setModelState(ready ? 'ready' : 'missing');
    });
    return () => {
      void detector.dispose();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${painelApi.insumos}?include_pending=1`, { credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Falha ao sincronizar cache local.');
        if (!cancelled) {
          await stockLocalStore.syncFromApi(data.insumos || [], lojaId);
        }
      } catch (e) {
        console.warn('[VisionStockScanner] cache sync:', e?.message);
      } finally {
        if (!cancelled) setSyncing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lojaId]);

  const shouldAccept = useCallback((key) => {
    const now = Date.now();
    const prev = lastByKey.current.get(key) ?? 0;
    if (now - prev < DETECTION_DEBOUNCE_MS) return false;
    lastByKey.current.set(key, now);
    return true;
  }, []);

  const applyStock = useCallback(
    async (insumoId, metaLabel) => {
      const res = await fetch(painelApi.estoqueScan, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ insumoId, direction, delta: 1 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Falha ao atualizar estoque.');
      setPhase('success');
      setLabel(metaLabel || data.insumo?.nome || '');
      playFeedback('ok');
      setRecent((prev) =>
        [
          {
            id: `${insumoId}-${Date.now()}`,
            nome: data.insumo?.nome || metaLabel,
            qty: data.insumo?.quantidade_atual,
          },
          ...prev,
        ].slice(0, 6)
      );
      window.setTimeout(() => setPhase('idle'), 800);
    },
    [direction]
  );

  const onFrame = useCallback(
    async (canvas) => {
      if (busyRef.current || syncing || !detectorRef.current) return;
      busyRef.current = true;
      try {
        const detection = await detectorRef.current.detect(canvas);
        if (!detection.label || detection.label === 'unknown') {
          setPhase('idle');
          return;
        }

        const debounceKey = `${detection.label}:${detection.ean || ''}`;
        if (!shouldAccept(debounceKey)) return;

        setPhase(detection.usedServer ? 'server' : 'local');
        setLabel(detection.label);

        let match =
          (detection.insumoId && (await stockLocalStore.findById(detection.insumoId))) ||
          (detection.ean && (await stockLocalStore.findByEan(detection.ean))) ||
          (await stockLocalStore.findByLabel(detection.label));

        if (!match) {
          playFeedback('err');
          if (detection.ean) {
            onUnknownEan?.(detection.ean);
            setUnknown({ ean: detection.ean, label: detection.label });
          } else {
            setPhase('error');
            setUnknown({ ean: '', label: detection.label });
          }
          return;
        }

        await applyStock(match.id, match.nome);
      } catch (e) {
        console.warn('[VisionStockScanner]', e?.message);
        setPhase('error');
      } finally {
        busyRef.current = false;
      }
    },
    [applyStock, onUnknownEan, shouldAccept, syncing]
  );

  return (
    <div className="relative">
      <CameraView onFrame={onFrame} />
      <VisionDetectionOverlay phase={phase} label={label} />

      {syncing ? (
        <p className="text-xs text-white/50 mt-2 m-0">Sincronizando catálogo local…</p>
      ) : null}

      {modelState === 'loading' ? (
        <p className="text-xs text-white/50 mt-2 m-0">Carregando modelo ONNX…</p>
      ) : null}

      {modelState === 'missing' ? (
        <p className="text-xs text-amber-200/90 mt-2 m-0">
          Modelo local ausente — rode{' '}
          <code className="text-[11px]">npm run vision:setup -w @finmemory/retailer</code>. Usando
          fallback nuvem quando disponível.
        </p>
      ) : null}

      {recent.length > 0 ? (
        <ul className="mt-4 space-y-1 list-none p-0 m-0 text-sm text-white/80">
          {recent.map((r) => (
            <li key={r.id}>
              {r.nome} → <span className="text-[#39FF14]">{r.qty}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {unknown && !unknown.ean ? (
        <p className="text-sm text-amber-200 mt-3 m-0" role="status">
          Detectado &quot;{unknown.label}&quot; — cadastre o insumo com esse nome no painel.
        </p>
      ) : null}

      {unknown?.ean ? (
        <StockScanUnknownModal
          ean={unknown.ean}
          direction={direction}
          onCreated={() => setUnknown(null)}
          onClose={() => setUnknown(null)}
        />
      ) : null}
    </div>
  );
}
