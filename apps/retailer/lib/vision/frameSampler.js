import { FRAME_SAMPLE_INTERVAL_MS } from './types';

/**
 * Amostra frames do vídeo sem bloquear a UI (requestAnimationFrame + throttle).
 *
 * @param {HTMLVideoElement} video
 * @param {(canvas: HTMLCanvasElement) => void} onFrame
 * @returns {() => void} stop
 */
export function startFrameSampler(video, onFrame) {
  let rafId = 0;
  let lastSampleAt = 0;
  let stopped = false;

  const tick = (now) => {
    if (stopped) return;
    rafId = requestAnimationFrame(tick);

    if (now - lastSampleAt < FRAME_SAMPLE_INTERVAL_MS) return;
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;

    lastSampleAt = now;
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    if (!w || !h) return;

    const canvas = document.createElement('canvas');
    canvas.width = Math.min(w, 640);
    canvas.height = Math.round((canvas.width / w) * h);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    onFrame(canvas);
  };

  rafId = requestAnimationFrame(tick);

  return () => {
    stopped = true;
    cancelAnimationFrame(rafId);
  };
}
