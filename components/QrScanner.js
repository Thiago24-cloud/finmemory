'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

const FILE_INPUT_ID = 'finmemory-qr-file-capture';

/**
 * Híbrido: mobile → foto nativa (input capture + jsQR); desktop → câmera ao vivo (getUserMedia + jsQR) com upload como alternativa.
 * Props inalterados: onScan(text), onClose().
 */
export function QrScanner({ onScan, onClose }) {
  const [mounted, setMounted] = useState(false);
  /** 'live' | 'file' */
  const [strategy, setStrategy] = useState(null);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [filePreview, setFilePreview] = useState(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState(null);
  const [liveError, setLiveError] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const stoppedRef = useRef(false);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return;
    const ua = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const touch = 'ontouchstart' in window;
    setIsMobileDevice(ua || touch);
    const preferLive =
      !ua && window.innerWidth > 768 && !('ontouchstart' in window);
    setStrategy(preferLive ? 'live' : 'file');
  }, [mounted]);

  const stopLive = useCallback(() => {
    stoppedRef.current = true;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((t) => t.stop());
      } catch (_) {}
      streamRef.current = null;
    }
    const v = videoRef.current;
    if (v) v.srcObject = null;
  }, []);

  useEffect(() => {
    return () => {
      if (filePreview) URL.revokeObjectURL(filePreview);
    };
  }, [filePreview]);

  useEffect(() => {
    if (!mounted || strategy !== 'live') return;
    stoppedRef.current = false;
    setLiveError(null);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    let lastTick = 0;
    const MIN_INTERVAL_MS = 100;

    const runLoop = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        streamRef.current = stream;
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        video.muted = true;
        video.playsInline = true;
        await video.play();

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          setLiveError('Não foi possível preparar o leitor.');
          return;
        }

        const tick = (now) => {
          if (stoppedRef.current) return;
          if (now - lastTick < MIN_INTERVAL_MS) {
            rafRef.current = requestAnimationFrame(tick);
            return;
          }
          lastTick = now;

          if (video.readyState >= video.HAVE_CURRENT_DATA) {
            const vw = video.videoWidth;
            const vh = video.videoHeight;
            if (vw && vh) {
              const maxDim = 1280;
              let w = vw;
              let h = vh;
              if (w > maxDim || h > maxDim) {
                const s = maxDim / Math.max(w, h);
                w = Math.floor(w * s);
                h = Math.floor(h * s);
              }
              if (canvas.width !== w || canvas.height !== h) {
                canvas.width = w;
                canvas.height = h;
              }
              ctx.drawImage(video, 0, 0, w, h);
              const imageData = ctx.getImageData(0, 0, w, h);
              const result = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: 'attemptBoth',
              });
              if (result?.data) {
                const cb = onScanRef.current;
                stopLive();
                if (cb) cb(result.data);
                return;
              }
            }
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch (e) {
        console.error('QrScanner live:', e);
        setLiveError(
          e?.name === 'NotAllowedError' || (e?.message && String(e.message).includes('Permission'))
            ? 'Permita o acesso à câmera nas configurações do navegador.'
            : 'Não foi possível abrir a câmera. Use HTTPS e um dispositivo com câmera — ou use «Tirar foto do QR».'
        );
      }
    };

    runLoop();

    return () => {
      stopLive();
    };
  }, [mounted, strategy, stopLive]);

  const decodeQrFromImageSource = useCallback(async (img) => {
    const maxDim = 1600;
    let w = img.width;
    let h = img.height;
    if (!w || !h) return null;
    if (w > maxDim || h > maxDim) {
      const s = maxDim / Math.max(w, h);
      w = Math.floor(w * s);
      h = Math.floor(h * s);
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    const result = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'attemptBoth',
    });
    return result?.data ?? null;
  }, []);

  const decodeQrFromFile = useCallback(
    async (file) => {
      if (typeof createImageBitmap === 'function') {
        const bitmap = await createImageBitmap(file);
        try {
          return await decodeQrFromImageSource(bitmap);
        } finally {
          try {
            bitmap.close();
          } catch (_) {}
        }
      }
      const url = URL.createObjectURL(file);
      try {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        await new Promise((resolve, reject) => {
          image.onload = resolve;
          image.onerror = reject;
          image.src = url;
        });
        return await decodeQrFromImageSource(image);
      } finally {
        URL.revokeObjectURL(url);
      }
    },
    [decodeQrFromImageSource]
  );

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;

    stopLive();
    setStrategy('file');
    setLiveError(null);
    setFileError(null);
    setFileLoading(true);
    const previewUrl = URL.createObjectURL(file);
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFilePreview(previewUrl);

    try {
      const text = await decodeQrFromFile(file);
      if (!text) {
        setFileError('QR Code não encontrado na imagem. Tente novamente com melhor iluminação.');
        return;
      }
      URL.revokeObjectURL(previewUrl);
      setFilePreview(null);
      onScan(text);
    } catch (err) {
      console.error('QrScanner file decode:', err);
      setFileError('Não foi possível ler a imagem.');
    } finally {
      setFileLoading(false);
    }
  };

  const handleRetake = () => {
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFilePreview(null);
    setFileError(null);
  };

  if (!mounted || strategy === null) {
    return (
      <div className="bg-black rounded-2xl overflow-hidden w-full max-w-sm mx-auto flex items-center justify-center text-white min-h-[200px] text-sm">
        Carregando…
      </div>
    );
  }

  if (strategy === 'file') {
    return (
      <div className="space-y-4">
        <div className="relative w-full max-w-md mx-auto">
          <label
            htmlFor={FILE_INPUT_ID}
            className="flex items-center justify-center w-full py-4 px-6 rounded-2xl bg-[#16a34a] text-white font-semibold cursor-pointer hover:bg-[#15803d] shadow-md transition-colors"
          >
            📷 Tirar foto do QR Code
          </label>
          <input
            id={FILE_INPUT_ID}
            type="file"
            accept="image/*"
            capture={isMobileDevice ? 'environment' : undefined}
            className="sr-only"
            onChange={handleFileChange}
          />
        </div>

        {filePreview && (
          <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50/80 p-3">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={filePreview}
                alt="Pré-visualização"
                className="h-20 w-20 shrink-0 rounded-lg object-cover border border-gray-200"
              />
              <div className="min-w-0 flex-1 text-sm text-gray-700">
                {fileLoading ? (
                  <span className="font-medium text-[#16a34a]">Lendo QR Code…</span>
                ) : fileError ? (
                  <span className="text-red-600">{fileError}</span>
                ) : (
                  <span>Processando…</span>
                )}
              </div>
            </div>
            {!fileLoading && (
              <button
                type="button"
                onClick={handleRetake}
                className="w-full py-2 text-sm font-medium text-[#0369a1] hover:underline"
              >
                Tirar outra foto
              </button>
            )}
          </div>
        )}

        {fileError && !filePreview && (
          <p className="text-red-600 text-sm text-center bg-red-50 py-2 px-3 rounded-xl">{fileError}</p>
        )}

        <button
          type="button"
          onClick={() => {
            handleRetake();
            setStrategy('live');
          }}
          className="w-full py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200"
        >
          Usar câmera ao vivo
        </button>

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

  return (
    <div className="space-y-4">
      <div className="relative min-h-[min(85vw,360px)] w-full max-w-md mx-auto rounded-2xl overflow-hidden bg-black ring-1 ring-white/10">
        <video
          ref={videoRef}
          className="w-full h-full min-h-[min(85vw,360px)] object-cover rounded-2xl"
          muted
          playsInline
          autoPlay
        />
        <canvas ref={canvasRef} className="hidden" aria-hidden />
      </div>
      {liveError && (
        <p className="text-red-600 text-sm text-center bg-red-50 py-2 px-3 rounded-xl">{liveError}</p>
      )}

      <div className="flex flex-col gap-2">
        <label
          htmlFor={`${FILE_INPUT_ID}-desktop`}
          className="block w-full py-3 px-4 text-center rounded-xl border border-gray-300 bg-white text-gray-800 font-medium cursor-pointer hover:bg-gray-50 text-sm"
        >
          Enviar foto / galeria
        </label>
        <input
          id={`${FILE_INPUT_ID}-desktop`}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={handleFileChange}
        />

        <button
          type="button"
          onClick={() => {
            stopLive();
            setStrategy('file');
            setLiveError(null);
          }}
          className="w-full py-2 text-sm text-gray-600 hover:text-gray-900"
        >
          Preferir só foto (modo celular)
        </button>
      </div>

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
