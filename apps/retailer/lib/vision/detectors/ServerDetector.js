import { DetectorService } from './DetectorService';
import { painelApi } from '../../merchant/painelApiPaths';

/**
 * Fallback online — envia frame (JPEG base64) para API de visão.
 */
export class ServerDetector extends DetectorService {
  constructor(options = {}) {
    super();
    this.endpoint = options.endpoint || painelApi.estoqueDetect;
    this.ready = true;
  }

  async isReady() {
    return true;
  }

  /**
   * @param {HTMLCanvasElement} frame
   */
  async detect(frame) {
    const started = performance.now();
    const dataUrl = frame.toDataURL('image/jpeg', 0.72);
    const imageBase64 = dataUrl.split(',')[1] || '';

    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ imageBase64 }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Falha na detecção na nuvem.');
    }

    const det = data.detection || data;
    return {
      label: det.label || 'unknown',
      confidence: Number(det.confidence) || 0,
      source: 'server',
      ean: det.ean ?? null,
      sku: det.sku ?? null,
      insumoId: det.insumoId ?? null,
      inferenceMs: Math.round(performance.now() - started),
    };
  }
}
