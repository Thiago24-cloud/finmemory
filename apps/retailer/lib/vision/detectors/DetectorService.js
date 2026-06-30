/**
 * Interface base para detectores de produto (plug .tflite / .onnx / TF.js).
 *
 * @typedef {import('../types').VisionDetection} VisionDetection
 * @typedef {import('../types').VisionFrame} VisionFrame
 */

export class DetectorService {
  /** @returns {Promise<boolean>} */
  async isReady() {
    return false;
  }

  /** @param {HTMLCanvasElement} frame */
  async detect(frame) {
    throw new Error('DetectorService.detect() não implementado');
  }

  async dispose() {
    /* noop */
  }
}
