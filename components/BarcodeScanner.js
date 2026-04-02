'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { isValidRetailBarcode } from '../lib/validateGtin';

const CONTAINER_ID = 'finmemory-barcode-reader';

/**
 * Leitor EAN/UPC via câmera (html5-qrcode + BarcodeDetector nativo quando existir).
 * Melhorias de leitura: área horizontal ampla (código 1D), resolução ideal alta,
 * fps maior, validação de dígitos verificadores, lanterna quando o aparelho permitir.
 */
export function BarcodeScanner({ onScan, onClose }) {
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const scannerRef = useRef(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTorch = useCallback(async () => {
    const instance = scannerRef.current;
    if (!instance?.isScanning) return;
    try {
      const caps = instance.getRunningTrackCameraCapabilities();
      const tf = caps.torchFeature();
      if (!tf.isSupported()) return;
      const next = !torchOn;
      await tf.apply(next);
      setTorchOn(next);
    } catch (_) {
      /* lanterna indisponível ou bloqueada */
    }
  }, [torchOn]);

  useEffect(() => {
    if (!mounted || typeof window === 'undefined' || !onScanRef.current) return;

    const el = document.getElementById(CONTAINER_ID);
    if (!el) return;

    let cancelled = false;

    async function start() {
      try {
        const lib = await import('html5-qrcode');
        const Html5Qrcode = lib.Html5Qrcode;
        const { Html5QrcodeSupportedFormats } = lib;
        if (cancelled) return;

        const instance = new Html5Qrcode(CONTAINER_ID, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E
          ],
          useBarCodeDetectorIfSupported: true,
          verbose: false
        });
        scannerRef.current = instance;

        const baseVideo = {
          width: { ideal: 1920, min: 640 },
          height: { ideal: 1080, min: 480 }
        };

        let cameraConfig = { facingMode: 'environment', ...baseVideo };
        try {
          const cameras = await Html5Qrcode.getCameras();
          if (cameras && cameras.length > 0) {
            const back = cameras.find((c) => /back|traseira|rear|environment/i.test(c.label || ''));
            if (back) {
              cameraConfig = { deviceId: { exact: back.id }, ...baseVideo };
            } else if (cameras.length > 1) {
              cameraConfig = { deviceId: { exact: cameras[cameras.length - 1].id }, ...baseVideo };
            }
          }
        } catch (_) {}

        const qrboxFunction = (viewfinderWidth, viewfinderHeight) => {
          const w = Math.min(Math.floor(viewfinderWidth * 0.92), viewfinderWidth);
          const h = Math.max(
            90,
            Math.min(Math.floor(viewfinderHeight * 0.38), Math.floor(viewfinderHeight * 0.5))
          );
          return { width: w, height: h };
        };

        await instance.start(
          cameraConfig,
          {
            fps: 12,
            qrbox: qrboxFunction,
            aspectRatio: 1.777,
            disableFlip: false
          },
          (decodedText) => {
            const cb = onScanRef.current;
            const raw = (decodedText && String(decodedText).trim()) || '';
            const digits = raw.replace(/\D/g, '');
            if (!cb || digits.length < 8) return;
            if (!isValidRetailBarcode(digits)) return;
            try {
              if (instance && instance.isScanning) instance.stop().catch(() => {});
            } catch (_) {}
            try {
              if (typeof navigator !== 'undefined' && navigator.vibrate) {
                navigator.vibrate(40);
              }
            } catch (_) {}
            cb(digits);
          },
          () => {}
        );

        try {
          const caps = instance.getRunningTrackCameraCapabilities();
          const tf = caps.torchFeature();
          setTorchSupported(tf.isSupported());
          setTorchOn(Boolean(tf.value()));
        } catch (_) {
          setTorchSupported(false);
        }

        const video = el.querySelector('video');
        if (video) {
          video.setAttribute('playsinline', 'true');
          video.setAttribute('webkit-playsinline', 'true');
          video.muted = true;
          video.playsInline = true;
          video.play().catch(() => {});
        }
      } catch (e) {
        if (cancelled) return;
        console.error('BarcodeScanner start error:', e);
        setError(
          e.name === 'NotAllowedError' || (e.message && e.message.includes('Permission'))
            ? 'Permita o acesso à câmera nas configurações do navegador.'
            : 'Não foi possível abrir a câmera. Use HTTPS e um dispositivo com câmera.'
        );
      }
    }

    const t = setTimeout(start, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
      setTorchSupported(false);
      setTorchOn(false);
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
      <div className="bg-black rounded-2xl overflow-hidden w-full max-w-sm mx-auto flex items-center justify-center text-white min-h-[320px]">
        Carregando câmera...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-center text-muted-foreground px-2 leading-relaxed">
        <strong>Dica:</strong> afaste o celular até o código inteiro aparecer na faixa clara; segure firme 1–2 s.
        Corredores escuros: use a lanterna.
      </p>
      {torchSupported && (
        <button
          type="button"
          onClick={() => toggleTorch()}
          className="w-full py-2.5 px-4 rounded-xl font-medium text-sm bg-amber-100 text-amber-900 border border-amber-200"
        >
          {torchOn ? 'Desligar lanterna' : 'Ligar lanterna'}
        </button>
      )}
      <div
        id={CONTAINER_ID}
        className="min-h-[320px] w-full max-w-sm mx-auto rounded-2xl overflow-hidden bg-black [&_.qr-shaded-region]:border-4 [&_.qr-shaded-region]:border-white [&_video]:rounded-2xl [&_video]:object-cover"
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
