/**
 * Ponte main thread ↔ visionInference.worker.js
 */
export class OnnxWorkerClient {
  constructor() {
    /** @type {Worker | null} */
    this.worker = null;
    /** @type {Map<string, { resolve: Function, reject: Function }>} */
    this.pending = new Map();
    this.ready = false;
    this.meta = null;
  }

  /**
   * @param {{ modelUrl: string, labelsUrl: string }} config
   */
  init(config) {
    if (typeof window === 'undefined') {
      return Promise.reject(new Error('OnnxWorkerClient só roda no browser.'));
    }

    this.worker = new Worker(new URL('../workers/visionInference.worker.js', import.meta.url), {
      type: 'module',
    });

    return new Promise((resolve, reject) => {
      this.worker.onmessage = (event) => {
        const data = event.data || {};

        if (data.type === 'ready') {
          this.ready = true;
          this.meta = data;
          resolve(data);
          return;
        }

        if (data.type === 'disposed') {
          this.ready = false;
          return;
        }

        if (data.type === 'error') {
          if (data.id && this.pending.has(data.id)) {
            const { reject: rej } = this.pending.get(data.id);
            this.pending.delete(data.id);
            rej(new Error(data.message || 'Erro no worker de visão'));
          } else if (!this.ready) {
            reject(new Error(data.message || 'Falha ao iniciar worker ONNX'));
          }
          return;
        }

        if (data.type === 'result' && data.id && this.pending.has(data.id)) {
          const { resolve: res } = this.pending.get(data.id);
          this.pending.delete(data.id);
          res(data);
        }
      };

      this.worker.onerror = (err) => {
        const message = err?.message || 'Worker crash';
        for (const { reject: rej } of this.pending.values()) {
          rej(new Error(message));
        }
        this.pending.clear();
        if (!this.ready) reject(new Error(message));
      };

      this.worker.postMessage({
        type: 'init',
        modelUrl: config.modelUrl,
        labelsUrl: config.labelsUrl,
      });
    });
  }

  /**
   * @param {ImageBitmap} bitmap
   */
  infer(bitmap) {
    if (!this.worker || !this.ready) {
      return Promise.reject(new Error('Worker ONNX não pronto'));
    }
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ type: 'infer', id, bitmap }, [bitmap]);
    });
  }

  dispose() {
    if (!this.worker) return;
    this.worker.postMessage({ type: 'dispose' });
    this.worker.terminate();
    this.worker = null;
    this.ready = false;
    this.pending.clear();
  }
}
