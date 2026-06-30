'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { startFrameSampler } from '../../../lib/vision/frameSampler';

/**
 * CameraView — captura frames do vídeo sem bloquear a thread de UI.
 *
 * @param {{
 *   onFrame: (canvas: HTMLCanvasElement) => void,
 *   onError?: (message: string) => void,
 *   className?: string,
 * }} props
 */
export function CameraView({ onFrame, onError, className = '' }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const stopSamplerRef = useRef(null);
  const onFrameRef = useRef(onFrame);
  const [starting, setStarting] = useState(true);
  const [error, setError] = useState('');

  onFrameRef.current = onFrame;

  const stop = useCallback(() => {
    stopSamplerRef.current?.();
    stopSamplerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        stopSamplerRef.current = startFrameSampler(video, (canvas) => {
          onFrameRef.current(canvas);
        });
        setStarting(false);
      } catch (e) {
        const msg =
          e?.name === 'NotAllowedError'
            ? 'Permita o acesso à câmera.'
            : 'Não foi possível abrir a câmera.';
        setError(msg);
        onError?.(msg);
        setStarting(false);
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, [onError, stop]);

  return (
    <div className={`relative rounded-2xl overflow-hidden bg-black aspect-[3/4] max-h-[min(70vh,520px)] ${className}`}>
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        playsInline
        muted
        autoPlay
      />
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-3 text-center">
        {starting ? (
          <p className="text-xs text-white/80 m-0 flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Abrindo câmera…
          </p>
        ) : error ? (
          <p className="text-xs text-red-300 m-0" role="alert">
            {error}
          </p>
        ) : (
          <p className="text-xs text-white/75 m-0 flex items-center justify-center gap-2">
            <Camera className="h-4 w-4" aria-hidden />
            Visão computacional ativa
          </p>
        )}
      </div>
    </div>
  );
}
