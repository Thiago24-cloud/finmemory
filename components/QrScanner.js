'use client';

import { useEffect, useRef, useState } from 'react';

const QR_CONTAINER_ID = 'finmemory-qr-reader';

/**
 * Scanner de QR code para NFC-e. Só renderiza no cliente (usa html5-qrcode que depende de window).
 * onScan(text) é chamado uma vez quando um código é lido; onClose() para cancelar.
 */
export function QrScanner({ onScan, onClose }) {
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState(null);
  const containerRef = useRef(null);
  const scannerRef = useRef(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === 'undefined' || !onScanRef.current) return;

    const el = document.getElementById(QR_CONTAINER_ID);
    if (!el) return;

    let instance = null;
    let cancelled = false;

    async function start() {
      try {
        const lib = await import('html5-qrcode');
        const Html5Qrcode = lib.Html5Qrcode;
        if (cancelled) return;
        instance = new Html5Qrcode(QR_CONTAINER_ID);
        scannerRef.current = instance;

        await instance.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 260, height: 260 }
          },
          (decodedText) => {
            const cb = onScanRef.current;
            if (!decodedText || !cb) return;
            try {
              if (instance && instance.isScanning) instance.stop().catch(() => {});
            } catch (_) {}
            cb(String(decodedText).trim());
          },
          () => {}
        );
      } catch (e) {
        if (cancelled) return;
        console.error('QrScanner start error:', e);
        setError(
          e.name === 'NotAllowedError' || (e.message && e.message.includes('Permission'))
            ? 'Permita o acesso à câmera nas configurações do navegador.'
            : 'Não foi possível abrir a câmera. Use HTTPS e um dispositivo com câmera.'
        );
      }
    }

    const t = setTimeout(start, 150);
    return () => {
      cancelled = true;
      clearTimeout(t);
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) scannerRef.current.stop().catch(() => {});
        } catch (_) {}
        scannerRef.current = null;
      }
    };
  }, [mounted]);

  if (!mounted) {
    return (
      <div className="bg-black rounded-2xl overflow-hidden w-full max-w-sm mx-auto flex items-center justify-center text-white min-h-[280px]">
        Carregando câmera...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        id={QR_CONTAINER_ID}
        ref={containerRef}
        className="min-h-[300px] w-full max-w-sm mx-auto rounded-2xl overflow-hidden bg-black [&_.qr-shaded-region]:border-4 [&_.qr-shaded-region]:border-white [&_video]:rounded-2xl [&_video]:object-cover"
      />
      {error && (
        <p className="text-red-600 text-sm text-center bg-red-50 py-2 px-3 rounded-xl">{error}</p>
      )}
      <button
        type="button"
        onClick={onClose}
        className="w-full py-3 px-4 bg-gray-200 text-gray-800 rounded-xl font-medium"
      >
        Cancelar
      </button>
    </div>
  );
}
