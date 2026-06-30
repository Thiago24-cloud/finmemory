'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { NotFoundException } from '@zxing/library';
import { Camera, Flashlight, Loader2, X } from 'lucide-react';
import { extractRetailBarcodeFromScan } from '../../lib/validateGtin';

/**
 * Scanner contínuo (ZXing) para bipagem de estoque no painel lojista.
 */
export function StockBarcodeScanner({ onScan, onClose, overlay = 'idle' }) {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const controlsRef = useRef(null);
  const onScanRef = useRef(onScan);
  const handledRef = useRef(false);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(true);
  const [torchOn, setTorchOn] = useState(false);
  const streamRef = useRef(null);

  onScanRef.current = onScan;

  const finishScan = useCallback((digits) => {
    if (handledRef.current) return;
    handledRef.current = true;
    onScanRef.current(digits);
    window.setTimeout(() => {
      handledRef.current = false;
    }, 500);
  }, []);

  const stop = useCallback(() => {
    try {
      controlsRef.current?.stop();
    } catch {
      /* */
    }
    controlsRef.current = null;
    readerRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    const start = async () => {
      await new Promise((r) => requestAnimationFrame(r));
      if (cancelled || !videoRef.current) return;

      try {
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result, err) => {
            if (err && !(err instanceof NotFoundException)) {
              return;
            }
            if (result) {
              const digits = extractRetailBarcodeFromScan(result.getText());
              if (digits) finishScan(digits);
            }
          }
        );
        if (!cancelled) {
          controlsRef.current = controls;
          const stream = videoRef.current?.srcObject;
          if (stream instanceof MediaStream) streamRef.current = stream;
          setStarting(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e?.name === 'NotAllowedError'
              ? 'Permita o acesso à câmera para bipar o estoque.'
              : 'Não foi possível abrir a câmera. Use HTTPS no celular.'
          );
          setStarting(false);
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
      stop();
    };
  }, [finishScan, stop]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks?.()[0];
    if (!track?.getCapabilities?.().torch) return;
    try {
      const next = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch {
      /* */
    }
  };

  const borderClass =
    overlay === 'success'
      ? 'border-[#39FF14] shadow-[0_0_24px_rgba(57,255,20,0.45)]'
      : overlay === 'error'
        ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.35)]'
        : overlay === 'processing'
          ? 'border-amber-400/80'
          : 'border-white/25';

  return (
    <div className="relative rounded-2xl overflow-hidden bg-black aspect-[3/4] max-h-[min(70vh,520px)]">
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        playsInline
        muted
        autoPlay
      />

      <div className={`absolute inset-4 rounded-xl border-2 transition-colors duration-200 pointer-events-none ${borderClass}`} />

      {overlay === 'processing' ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
          <Loader2 className="h-10 w-10 animate-spin text-[#39FF14]" aria-hidden />
        </div>
      ) : null}

      <div className="absolute top-3 right-3 flex gap-2 z-10">
        <button
          type="button"
          onClick={() => void toggleTorch()}
          className="rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
          aria-label="Lanterna"
        >
          <Flashlight className={`h-5 w-5 ${torchOn ? 'text-[#39FF14]' : ''}`} aria-hidden />
        </button>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
            aria-label="Fechar câmera"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        ) : null}
      </div>

      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-3 text-center">
        {starting ? (
          <p className="text-xs text-white/80 m-0 flex items-center justify-center gap-2">
            <Camera className="h-4 w-4" aria-hidden />
            Abrindo câmera…
          </p>
        ) : error ? (
          <p className="text-xs text-red-300 m-0" role="alert">
            {error}
          </p>
        ) : (
          <p className="text-xs text-white/75 m-0">Aponte para o código de barras do produto</p>
        )}
      </div>
    </div>
  );
}
