'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { isValidRetailBarcode } from '../lib/validateGtin';

const BODY_CLASS = 'finmemory-native-barcode-scan-active';
const HTML_CLASS = 'finmemory-native-barcode-scan-html';

/**
 * Scanner nativo (ML Kit no Android/iOS via @capacitor-mlkit/barcode-scanning).
 * Câmera fica atrás do WebView; o corpo fica transparente e só este overlay permanece visível.
 */
export function NativeBarcodeScanner({ onScan, onClose, onFallbackToWeb }) {
  const [error, setError] = useState(null);
  const [permDenied, setPermDenied] = useState(false);
  const [starting, setStarting] = useState(true);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const handledRef = useRef(false);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const cleanup = useCallback(async () => {
    try {
      const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');
      await BarcodeScanner.removeAllListeners();
      await BarcodeScanner.stopScan();
    } catch (_) {}
    document.documentElement.classList.remove(HTML_CLASS);
    document.body.classList.remove(BODY_CLASS);
  }, []);

  const finishWithCode = useCallback(
    async (digits) => {
      if (handledRef.current) return;
      handledRef.current = true;
      await cleanup();
      try {
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(40);
      } catch (_) {}
      onScanRef.current(digits);
    },
    [cleanup]
  );

  useEffect(() => {
    handledRef.current = false;
    document.documentElement.classList.add(HTML_CLASS);
    document.body.classList.add(BODY_CLASS);

    let cancelled = false;

    (async () => {
      try {
        const { BarcodeScanner, BarcodeFormat, LensFacing, Resolution } = await import(
          '@capacitor-mlkit/barcode-scanning'
        );

        const perm = await BarcodeScanner.checkPermissions();
        let camera = perm.camera;
        if (camera !== 'granted' && camera !== 'limited') {
          const req = await BarcodeScanner.requestPermissions();
          camera = req.camera;
        }
        if (camera !== 'granted' && camera !== 'limited') {
          if (!cancelled) {
            setPermDenied(true);
            setStarting(false);
            setError('Permissão da câmera necessária para o leitor nativo.');
            document.documentElement.classList.remove(HTML_CLASS);
            document.body.classList.remove(BODY_CLASS);
          }
          return;
        }

        const torchAvailRes = await BarcodeScanner.isTorchAvailable();
        if (!cancelled) setTorchAvailable(Boolean(torchAvailRes?.available));

        await BarcodeScanner.startScan({
          formats: [
            BarcodeFormat.Ean13,
            BarcodeFormat.Ean8,
            BarcodeFormat.UpcA,
            BarcodeFormat.UpcE
          ],
          lensFacing: LensFacing.Back,
          resolution: Resolution['1920x1080']
        });

        await BarcodeScanner.addListener('barcodesScanned', (event) => {
          const list = event?.barcodes || [];
          for (const b of list) {
            const raw = (b.rawValue != null ? b.rawValue : b.displayValue) || '';
            const digits = String(raw).replace(/\D/g, '');
            if (!isValidRetailBarcode(digits)) continue;
            finishWithCode(digits);
            break;
          }
        });

        await BarcodeScanner.addListener('scanError', (e) => {
          console.warn('NativeBarcodeScanner scanError:', e?.message);
        });

        if (!cancelled) setStarting(false);
      } catch (e) {
        console.error('NativeBarcodeScanner start error:', e);
        if (!cancelled) {
          setError(e?.message || 'Não foi possível iniciar o leitor nativo.');
          setStarting(false);
          await cleanup();
          if (typeof onFallbackToWeb === 'function') {
            onFallbackToWeb();
          }
        }
      }
    })();

    return () => {
      cancelled = true;
      (async () => {
        await cleanup();
      })();
    };
  }, [cleanup, finishWithCode, onFallbackToWeb]);

  const handleClose = async () => {
    await cleanup();
    onClose();
  };

  const toggleTorch = async () => {
    try {
      const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');
      await BarcodeScanner.toggleTorch();
      const { enabled } = await BarcodeScanner.isTorchEnabled();
      setTorchOn(Boolean(enabled));
    } catch (_) {}
  };

  const openSettings = async () => {
    try {
      const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');
      await BarcodeScanner.openSettings();
    } catch (_) {}
  };

  return (
    <div className="finmemory-barcode-scanner-ui fixed inset-0 z-[99999] flex flex-col justify-between pointer-events-none">
      <div className="pointer-events-auto bg-black/55 text-white px-4 py-3 safe-area-top">
        <p className="text-sm font-semibold m-0 text-center">Leitor nativo (ML Kit)</p>
        <p className="text-xs text-white/85 m-0 mt-1 text-center">
          Aponte para o código de barras do produto. Segure firme até vibrar.
        </p>
      </div>

      <div className="flex-1 min-h-0" aria-hidden />

      <div className="pointer-events-auto space-y-2 px-4 pb-6 pt-3 safe-area-bottom bg-black/55">
        {starting && <p className="text-center text-white text-sm m-0">Iniciando câmera…</p>}
        {error && (
          <div className="rounded-xl bg-red-950/90 text-red-100 text-xs px-3 py-2 text-center">{error}</div>
        )}
        {permDenied && (
          <>
            <button
              type="button"
              onClick={openSettings}
              className="w-full py-2.5 rounded-xl bg-white/15 text-white text-sm font-medium"
            >
              Abrir configurações (permissão)
            </button>
            {typeof onFallbackToWeb === 'function' && (
              <button
                type="button"
                onClick={() => onFallbackToWeb()}
                className="w-full py-2.5 rounded-xl bg-white text-gray-900 text-sm font-semibold"
              >
                Usar leitor da câmera do site
              </button>
            )}
          </>
        )}
        <div className="flex gap-2">
          {torchAvailable && (
            <button
              type="button"
              onClick={toggleTorch}
              className="flex-1 py-3 rounded-xl bg-amber-400/90 text-amber-950 text-sm font-bold"
            >
              {torchOn ? 'Lanterna off' : 'Lanterna'}
            </button>
          )}
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 py-3 rounded-xl bg-white text-gray-900 text-sm font-bold"
          >
            Cancelar
          </button>
        </div>
        {typeof onFallbackToWeb === 'function' && (
          <button
            type="button"
            onClick={async () => {
              await cleanup();
              onFallbackToWeb();
            }}
            className="w-full py-2 text-white/80 text-xs underline"
          >
            Usar leitor da câmera do site
          </button>
        )}
      </div>
    </div>
  );
}
