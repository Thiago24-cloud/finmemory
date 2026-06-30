import { DetectorService } from './DetectorService';
import { OnnxWorkerClient } from '../onnx/OnnxWorkerClient';

const DEFAULT_MODEL = '/models/stock-v1/model.onnx';
const DEFAULT_LABELS = '/models/stock-v1/labels.json';

/**
 * Detector local ONNX (offline-first) via Web Worker + onnxruntime-web.
 *
 * Setup:
 *   npm run vision:setup -w @finmemory/retailer
 *   NEXT_PUBLIC_VISION_MODEL_URL=/models/stock-v1/model.onnx  (opcional)
 *
 * Substitua model.onnx pelo export do seu treino (mesmo contrato: NCHW 320×320, logits).
 */
export class LocalDetector extends DetectorService {
  constructor(options = {}) {
    super();
    this.modelUrl =
      options.modelUrl ||
      (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_VISION_MODEL_URL) ||
      DEFAULT_MODEL;
    this.labelsUrl = options.labelsUrl || DEFAULT_LABELS;
    /** @type {OnnxWorkerClient | null} */
    this.workerClient = null;
    this.ready = false;
    this.loadError = null;
  }

  async isReady() {
    return this.ready;
  }

  async load() {
    if (typeof window === 'undefined') {
      this.ready = false;
      return;
    }

    try {
      const head = await fetch(this.modelUrl, { method: 'HEAD', cache: 'force-cache' });
      if (!head.ok) {
        console.warn('[LocalDetector] model.onnx ausente — rode: npm run vision:setup -w @finmemory/retailer');
        this.ready = false;
        return;
      }

      this.workerClient = new OnnxWorkerClient();
      const meta = await this.workerClient.init({
        modelUrl: this.modelUrl,
        labelsUrl: this.labelsUrl,
      });
      console.info('[LocalDetector] ONNX pronto', meta);
      this.ready = true;
      this.loadError = null;
    } catch (error) {
      console.warn('[LocalDetector] falha ao carregar ONNX:', error?.message || error);
      this.loadError = error?.message || String(error);
      this.ready = false;
      this.workerClient?.dispose();
      this.workerClient = null;
    }
  }

  /**
   * @param {HTMLCanvasElement} frame
   */
  async detect(frame) {
    const started = performance.now();

    if (!this.ready || !this.workerClient) {
      return {
        label: 'unknown',
        confidence: 0,
        source: 'local',
        ean: null,
        sku: null,
        insumoId: null,
        inferenceMs: 0,
      };
    }

    let bitmap;
    try {
      bitmap = await createImageBitmap(frame);
      const result = await this.workerClient.infer(bitmap);
      return {
        label: result.label,
        confidence: result.confidence,
        source: 'local',
        ean: result.ean ?? null,
        sku: null,
        insumoId: null,
        inferenceMs: result.inferenceMs ?? Math.round(performance.now() - started),
      };
    } catch (error) {
      console.warn('[LocalDetector] inferência:', error?.message);
      return {
        label: 'unknown',
        confidence: 0,
        source: 'local',
        ean: null,
        sku: null,
        insumoId: null,
        inferenceMs: Math.round(performance.now() - started),
      };
    } finally {
      bitmap?.close?.();
    }
  }

  async dispose() {
    this.workerClient?.dispose();
    this.workerClient = null;
    this.ready = false;
  }
}
