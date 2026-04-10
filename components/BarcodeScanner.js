'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { NotFoundException } from '@zxing/library';
import { extractRetailBarcodeFromScan } from '../lib/validateGtin';

const MAX_DECODE_WIDTH = 1280;
const DARK_SKIP_THRESHOLD = 40;
const GAMMA_THRESHOLD = 80;
const GAMMA_EXP = 0.45;
const CONTRAST_FACTOR = 1.8;

const FAIL_MSG =
  'Não conseguimos ler. Tente com mais luz ou ative a lanterna do celular.';
const DARK_MSG =
  'Ambiente muito escuro — ative a lanterna antes de fotografar.';

function computeUseDesktopVideo() {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isIPadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  const mobileUa = /iPhone|iPad|iPod|Android/i.test(ua) || isIPadOs;
  const hasTouch = 'ontouchstart' in window;
  const wide = window.innerWidth > 768;
  return !mobileUa && !hasTouch && wide;
}

function isIOSSafari() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function vibrateShort() {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(40);
  } catch (_) {
    /* */
  }
}

function clamp255(n) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function scaleToMaxWidth(w, h, maxW) {
  if (w <= maxW) return { width: w, height: h };
  const scale = maxW / w;
  return { width: Math.round(maxW), height: Math.round(h * scale) };
}

/** Luminância média 0–255 (BT.601). */
function getMeanLuminanceFromImageData(data) {
  let sum = 0;
  const n = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    sum += 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return n ? sum / n : 0;
}

/** Histograma de luminância (0–255) — auto-contraste adaptativo. */
function luminanceHistogram(data) {
  const h = new Uint32Array(256);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const y = Math.min(255, Math.round(0.299 * r + 0.587 * g + 0.114 * b));
    h[y]++;
  }
  return h;
}

function drawSourceToCanvas(source, maxW = MAX_DECODE_WIDTH) {
  const nw = source.naturalWidth || source.width || source.videoWidth || 1;
  const nh = source.naturalHeight || source.height || source.videoHeight || 1;
  const { width, height } = scaleToMaxWidth(nw, nh, maxW);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  const mean = getMeanLuminanceFromImageData(imageData.data);
  luminanceHistogram(imageData.data);
  return { canvas, width, height, meanLuminance: mean };
}

/** Gamma + contraste + sharpen 3×3 em novo canvas. */
function preprocessCanvas(sourceCanvas, meanLuminance) {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const ctx = sourceCanvas.getContext('2d', { willReadFrequently: true });
  const src = ctx.getImageData(0, 0, w, h);
  const d = src.data;
  const tmp = new Uint8ClampedArray(d.length);
  const darkBoost = meanLuminance < GAMMA_THRESHOLD;

  for (let i = 0; i < d.length; i += 4) {
    let r = d[i];
    let g = d[i + 1];
    let b = d[i + 2];
    const a = d[i + 3];
    if (darkBoost) {
      r = 255 * Math.pow(Math.max(r, 0) / 255, GAMMA_EXP);
      g = 255 * Math.pow(Math.max(g, 0) / 255, GAMMA_EXP);
      b = 255 * Math.pow(Math.max(b, 0) / 255, GAMMA_EXP);
    }
    r = (r - 128) * CONTRAST_FACTOR + 128;
    g = (g - 128) * CONTRAST_FACTOR + 128;
    b = (b - 128) * CONTRAST_FACTOR + 128;
    tmp[i] = clamp255(r);
    tmp[i + 1] = clamp255(g);
    tmp[i + 2] = clamp255(b);
    tmp[i + 3] = a;
  }

  const out = new Uint8ClampedArray(d.length);
  const k = [0, -1, 0, -1, 5, -1, 0, -1, 0];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const di = (y * w + x) * 4;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const yy = Math.min(h - 1, Math.max(0, y + ky));
          const xx = Math.min(w - 1, Math.max(0, x + kx));
          const ki = (ky + 1) * 3 + (kx + 1);
          const weight = k[ki];
          const si = (yy * w + xx) * 4;
          r += tmp[si] * weight;
          g += tmp[si + 1] * weight;
          b += tmp[si + 2] * weight;
        }
      }
      out[di] = clamp255(r);
      out[di + 1] = clamp255(g);
      out[di + 2] = clamp255(b);
      out[di + 3] = tmp[di + 3];
    }
  }

  const outCanvas = document.createElement('canvas');
  outCanvas.width = w;
  outCanvas.height = h;
  const octx = outCanvas.getContext('2d', { willReadFrequently: true });
  octx.putImageData(new ImageData(out, w, h), 0, 0);
  return outCanvas;
}

/** Escala de cinza pura. */
function grayscaleCanvas(sourceCanvas) {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const ctx = sourceCanvas.getContext('2d', { willReadFrequently: true });
  const src = ctx.getImageData(0, 0, w, h);
  const d = src.data;
  const out = new Uint8ClampedArray(d.length);
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const y = clamp255(0.299 * r + 0.587 * g + 0.114 * b);
    out[i] = y;
    out[i + 1] = y;
    out[i + 2] = y;
    out[i + 3] = d[i + 3];
  }
  const outCanvas = document.createElement('canvas');
  outCanvas.width = w;
  outCanvas.height = h;
  const octx = outCanvas.getContext('2d', { willReadFrequently: true });
  octx.putImageData(new ImageData(out, w, h), 0, 0);
  return outCanvas;
}

function tryDecodeCanvas(reader, canvas) {
  try {
    const result = reader.decodeFromCanvas(canvas);
    const text = result?.getText?.() ?? '';
    return extractRetailBarcodeFromScan(text);
  } catch (err) {
    if (err instanceof NotFoundException || err?.name === 'NotFoundException') return null;
    throw err;
  }
}

/**
 * 3 tentativas: original → pré-processada → cinza.
 * meanLuminance < DARK_SKIP_THRESHOLD: não chama ZXing.
 */
async function decodeWithPipeline(canvas, meanLuminance, setAttemptLabel) {
  if (meanLuminance < DARK_SKIP_THRESHOLD) {
    return { ok: false, dark: true };
  }

  const reader = new BrowserMultiFormatReader();

  const yieldUi = () => new Promise((r) => requestAnimationFrame(() => r()));

  setAttemptLabel('1/3');
  await yieldUi();
  let digits = tryDecodeCanvas(reader, canvas);
  if (digits) return { ok: true, digits };

  setAttemptLabel('2/3');
  await yieldUi();
  const preprocessed = preprocessCanvas(canvas, meanLuminance);
  digits = tryDecodeCanvas(reader, preprocessed);
  if (digits) return { ok: true, digits };

  setAttemptLabel('3/3');
  await yieldUi();
  const gray = grayscaleCanvas(canvas);
  digits = tryDecodeCanvas(reader, gray);
  if (digits) return { ok: true, digits };

  return { ok: false, dark: false };
}

async function tryEnableTorch(track) {
  if (!track?.applyConstraints) return false;
  try {
    await track.applyConstraints({ advanced: [{ torch: true }] });
    return true;
  } catch (_) {
    /* */
  }
  try {
    const caps = track.getCapabilities?.();
    if (caps && Object.prototype.hasOwnProperty.call(caps, 'torch') && caps.torch) {
      await track.applyConstraints({ torch: true });
      return true;
    }
  } catch (_) {
    /* */
  }
  return false;
}

async function disableTorch(track) {
  if (!track?.applyConstraints) return;
  try {
    await track.applyConstraints({ advanced: [{ torch: false }] });
  } catch (_) {
    /* */
  }
  try {
    await track.applyConstraints({ torch: false });
  } catch (_) {
    /* */
  }
}

function stopMediaStream(stream) {
  if (!stream) return;
  stream.getTracks().forEach((t) => {
    try {
      t.stop();
    } catch (_) {
      /* */
    }
  });
}

async function captureFrameFromStream(stream, videoEl) {
  const track = stream.getVideoTracks()[0];
  if (typeof ImageCapture !== 'undefined' && track) {
    try {
      const ic = new ImageCapture(track);
      const blob = await ic.takePhoto();
      const bmp = await createImageBitmap(blob);
      return bmp;
    } catch (_) {
      /* fallback canvas */
    }
  }
  const v = videoEl;
  if (!v || !v.videoWidth || !v.videoHeight) throw new Error('Vídeo indisponível');
  const { canvas } = drawSourceToCanvas(v, MAX_DECODE_WIDTH);
  return createImageBitmap(canvas);
}

/**
 * Leitor EAN/UPC: mobile — file capture + opcional flash (getUserMedia + torch) + ZXing com pré-processamento;
 * desktop — getUserMedia + ZXing no vídeo. Após extrair código, o pai faz lookup (inalterado).
 */
export function BarcodeScanner({ onScan, onClose }) {
  const [mounted, setMounted] = useState(false);
  const [useDesktopVideo, setUseDesktopVideo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [decodeError, setDecodeError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [videoError, setVideoError] = useState(null);
  const [attemptLabel, setAttemptLabel] = useState('');
  const [darkWarning, setDarkWarning] = useState(null);
  const [toast, setToast] = useState(null);
  const [flashOpen, setFlashOpen] = useState(false);

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const flashVideoRef = useRef(null);
  const flashStreamRef = useRef(null);
  const scanControlsRef = useRef(null);
  const readerRef = useRef(null);
  const onScanRef = useRef(onScan);
  const toastTimerRef = useRef(null);
  onScanRef.current = onScan;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function update() {
      setUseDesktopVideo(computeUseDesktopVideo());
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      stopMediaStream(flashStreamRef.current);
    };
  }, []);

  const showToast = useCallback((msg) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 4500);
  }, []);

  const resetMobileState = useCallback(() => {
    setDecodeError(null);
    setDarkWarning(null);
    setAttemptLabel('');
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const runDecodeFromBitmap = useCallback(async (bitmap) => {
    setDecodeError(null);
    setDarkWarning(null);
    setLoading(true);
    setAttemptLabel('');

    try {
      const { canvas, meanLuminance } = drawSourceToCanvas(bitmap, MAX_DECODE_WIDTH);
      try {
        bitmap.close?.();
      } catch (_) {
        /* */
      }

      const result = await decodeWithPipeline(canvas, meanLuminance, setAttemptLabel);

      if (result.dark) {
        setDarkWarning(DARK_MSG);
        setLoading(false);
        setAttemptLabel('');
        return;
      }

      if (result.ok && result.digits) {
        vibrateShort();
        onScanRef.current?.(result.digits);
        return;
      }

      setDecodeError(FAIL_MSG);
    } catch (err) {
      console.warn('BarcodeScanner decode:', err);
      setDecodeError(FAIL_MSG);
    } finally {
      setLoading(false);
      setAttemptLabel('');
    }
  }, []);

  const handleFileChange = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (!file || !file.type.startsWith('image/')) return;

      const url = URL.createObjectURL(file);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });

      let bmp;
      try {
        bmp = await createImageBitmap(file);
      } catch (err) {
        console.warn('BarcodeScanner createImageBitmap:', err);
        setDecodeError(FAIL_MSG);
        return;
      }

      await runDecodeFromBitmap(bmp);
    },
    [runDecodeFromBitmap]
  );

  const closeFlashModal = useCallback(async () => {
    const stream = flashStreamRef.current;
    const track = stream?.getVideoTracks?.()[0];
    if (track) await disableTorch(track);
    stopMediaStream(stream);
    flashStreamRef.current = null;
    setFlashOpen(false);
  }, []);

  const openFlashCamera = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      showToast('Câmera direta indisponível. Use o botão principal.');
      fileInputRef.current?.click();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      const track = stream.getVideoTracks()[0];
      const torchOk = await tryEnableTorch(track);

      if (!torchOk && isIOSSafari()) {
        stopMediaStream(stream);
        showToast('Ative a lanterna manualmente nas configurações do celular.');
        setTimeout(() => fileInputRef.current?.click(), 400);
        return;
      }

      flashStreamRef.current = stream;
      setFlashOpen(true);
    } catch (e) {
      console.warn('BarcodeScanner flash camera:', e);
      showToast('Não foi possível abrir a câmera. Use o botão principal.');
      fileInputRef.current?.click();
    }
  }, [showToast]);

  useEffect(() => {
    if (!flashOpen) return;
    const stream = flashStreamRef.current;
    const el = flashVideoRef.current;
    if (!el || !stream) return;
    el.srcObject = stream;
    const p = el.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
    return () => {
      try {
        el.srcObject = null;
      } catch (_) {
        /* */
      }
    };
  }, [flashOpen]);

  const captureFlashPhoto = useCallback(async () => {
    const stream = flashStreamRef.current;
    if (!stream) return;

    setLoading(true);
    try {
      const track = stream.getVideoTracks()[0];
      const bmp = await captureFrameFromStream(stream, flashVideoRef.current);
      await disableTorch(track);
      stopMediaStream(stream);
      flashStreamRef.current = null;
      setFlashOpen(false);

      const url = URL.createObjectURL(await bmpToBlob(bmp));
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });

      await runDecodeFromBitmap(bmp);
    } catch (e) {
      console.warn('BarcodeScanner capture flash:', e);
      await closeFlashModal();
      setDecodeError(FAIL_MSG);
    } finally {
      setLoading(false);
    }
  }, [closeFlashModal, runDecodeFromBitmap]);

  useEffect(() => {
    if (!mounted || !useDesktopVideo || typeof window === 'undefined') return;

    let cancelled = false;
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    const start = async () => {
      await new Promise((r) => requestAnimationFrame(() => r()));
      await new Promise((r) => requestAnimationFrame(() => r()));
      if (cancelled || !videoRef.current) return;

      try {
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result, err, ctrl) => {
            if (err && !(err instanceof NotFoundException) && err?.name !== 'NotFoundException') {
              /* frames sem código: ignorar */
            }
            if (result) {
              const text = result.getText();
              const digits = extractRetailBarcodeFromScan(text);
              if (digits && onScanRef.current) {
                try {
                  ctrl.stop();
                } catch (_) {
                  /* */
                }
                vibrateShort();
                onScanRef.current(digits);
              }
            }
          }
        );
        if (!cancelled) scanControlsRef.current = controls;
      } catch (e) {
        if (!cancelled) {
          console.error('BarcodeScanner video:', e);
          setVideoError(
            e?.name === 'NotAllowedError' || String(e?.message || '').includes('Permission')
              ? 'Permita o acesso à câmera nas configurações do navegador.'
              : 'Não foi possível abrir a câmera. Use HTTPS e um dispositivo com câmera.'
          );
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      try {
        scanControlsRef.current?.stop();
      } catch (_) {
        /* */
      }
      scanControlsRef.current = null;
      readerRef.current = null;
      setVideoError(null);
    };
  }, [mounted, useDesktopVideo]);

  if (!mounted) {
    return (
      <div className="bg-black rounded-2xl overflow-hidden w-full max-w-sm mx-auto flex items-center justify-center text-white min-h-[320px]">
        Carregando leitor…
      </div>
    );
  }

  return (
    <div className="space-y-4 relative">
      {toast && (
        <div
          className="fixed left-1/2 top-[20%] z-[100020] -translate-x-1/2 max-w-[min(100vw-2rem,320px)] rounded-xl bg-[#111827] px-4 py-3 text-center text-sm text-white shadow-lg"
          role="status"
        >
          {toast}
        </div>
      )}

      {flashOpen && (
        <div
          className="fixed inset-0 z-[100010] flex flex-col bg-black/95 p-4"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-white text-sm text-center mb-2 m-0">Enquadre o código e toque em Capturar</p>
          <video
            ref={flashVideoRef}
            className="w-full flex-1 min-h-[200px] max-h-[60vh] rounded-xl bg-black object-cover"
            playsInline
            muted
            autoPlay
          />
          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={async () => {
                await closeFlashModal();
              }}
              className="flex-1 py-3 rounded-xl bg-gray-700 text-white font-semibold"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={captureFlashPhoto}
              className="flex-1 py-3 rounded-xl bg-amber-500 text-black font-semibold disabled:opacity-50"
            >
              Capturar foto
            </button>
          </div>
        </div>
      )}

      <p className="text-sm text-center text-muted-foreground px-2 leading-relaxed">
        <strong>Dica:</strong> afaste o celular até o código inteiro aparecer na faixa clara; segure firme 1–2 s. Em
        corredores escuros use <strong>lanterna</strong> ou o botão com flash.
      </p>

      {!useDesktopVideo ? (
        <div className="space-y-4">
          <label className="relative block w-full cursor-pointer select-none">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
              onChange={handleFileChange}
              disabled={loading}
            />
            <div className="flex min-h-[52px] w-full items-center justify-center rounded-xl bg-[#1a7f37] px-4 py-4 text-center text-base font-semibold text-white shadow-md pointer-events-none">
              📷 Abrir câmera para escanear
            </div>
          </label>

          <button
            type="button"
            disabled={loading || flashOpen}
            onClick={openFlashCamera}
            className="flex min-h-[52px] w-full items-center justify-center rounded-xl border-2 border-amber-500 bg-amber-50 px-4 py-4 text-center text-base font-semibold text-amber-900 shadow-sm disabled:opacity-50"
          >
            📷 Abrir câmera com flash
          </button>

          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt=""
              className="mx-auto max-h-40 w-auto max-w-full rounded-xl border border-[#e5e7eb] object-contain bg-[#f9fafb]"
            />
          )}

          {darkWarning && (
            <div className="rounded-xl bg-amber-50 px-3 py-3 text-center border border-amber-200">
              <p className="text-sm text-amber-900 m-0">{darkWarning}</p>
              <button
                type="button"
                onClick={resetMobileState}
                className="mt-2 w-full rounded-lg bg-white py-2 px-3 text-sm font-semibold text-[#1a7f37] border border-amber-300"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {loading && (
            <p className="text-center text-sm text-[#374151] m-0">
              Processando imagem… {attemptLabel ? `tentativa ${attemptLabel}` : ''}
            </p>
          )}

          {decodeError && (
            <div className="space-y-2 rounded-xl bg-red-50 px-3 py-3 text-center border border-red-200">
              <p className="text-sm text-red-700 m-0">{decodeError}</p>
              <p className="text-xs text-red-600/90 m-0">
                Você também pode digitar o código abaixo (EAN / UPC).
              </p>
              <button
                type="button"
                onClick={resetMobileState}
                className="w-full rounded-lg bg-white py-2 px-3 text-sm font-semibold text-[#1a7f37] border border-red-200"
              >
                Tentar novamente
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <video
            ref={videoRef}
            className="min-h-[320px] w-full max-w-sm mx-auto rounded-2xl overflow-hidden bg-black object-cover"
            muted
            playsInline
            autoPlay
          />
          {videoError && (
            <p className="text-red-600 text-sm text-center bg-red-50 py-2 px-3 rounded-xl">{videoError}</p>
          )}
        </div>
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

/** Converte ImageBitmap em Blob (JPEG) para preview URL. */
async function bmpToBlob(bitmap) {
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('toBlob failed'));
      },
      'image/jpeg',
      0.92
    );
  });
}
