'use client';

import { useEffect, useState, useCallback } from 'react';
import { BarcodeScanner } from './BarcodeScanner';
import { NativeBarcodeScanner } from './NativeBarcodeScanner';

/**
 * No app Capacitor (Android/iOS): ML Kit via @capacitor-mlkit/barcode-scanning.
 * No browser / PWA web: ZXing (BarcodeScanner — captura nativa no mobile, vídeo no desktop).
 */
export function ProductBarcodeScanner({ onScan, onClose }) {
  const [phase, setPhase] = useState('checking'); // checking | native | web
  const [webOverride, setWebOverride] = useState(false);

  useEffect(() => {
    if (webOverride) return;

    let cancelled = false;

    (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform()) {
          if (!cancelled) setPhase('web');
          return;
        }
        const { BarcodeScanner: MLKit } = await import('@capacitor-mlkit/barcode-scanning');
        const { supported } = await MLKit.isSupported();
        if (!cancelled) setPhase(supported ? 'native' : 'web');
      } catch {
        if (!cancelled) setPhase('web');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [webOverride]);

  const handleFallbackToWeb = useCallback(() => {
    setWebOverride(true);
  }, []);

  if (webOverride) {
    return <BarcodeScanner onScan={onScan} onClose={onClose} />;
  }

  if (phase === 'checking') {
    return (
      <div className="bg-black rounded-2xl overflow-hidden w-full max-w-sm mx-auto flex flex-col items-center justify-center text-white min-h-[280px] px-4">
        <p className="text-sm text-center m-0">Preparando leitor…</p>
      </div>
    );
  }

  if (phase === 'native' && !webOverride) {
    return (
      <NativeBarcodeScanner
        onScan={onScan}
        onClose={onClose}
        onFallbackToWeb={handleFallbackToWeb}
      />
    );
  }

  return <BarcodeScanner onScan={onScan} onClose={onClose} />;
}
