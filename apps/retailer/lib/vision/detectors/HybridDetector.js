import { LOCAL_CONFIDENCE_THRESHOLD } from '../types';
import { LocalDetector } from './LocalDetector';
import { ServerDetector } from './ServerDetector';

/**
 * Orquestrador híbrido: offline primeiro, nuvem se confiança baixa.
 */
export class HybridDetector {
  /**
   * @param {{ local?: import('./LocalDetector').LocalDetector, server?: import('./ServerDetector').ServerDetector, threshold?: number }} [options]
   */
  constructor(options = {}) {
    this.local = options.local || new LocalDetector();
    this.server = options.server || new ServerDetector();
    this.threshold = options.threshold ?? LOCAL_CONFIDENCE_THRESHOLD;
  }

  async init() {
    await this.local.load();
  }

  /**
   * @param {HTMLCanvasElement} frame
   * @returns {Promise<import('../types').VisionDetection & { usedServer: boolean }>}
   */
  async detect(frame) {
    const localResult = await this.local.detect(frame);

    if (localResult.confidence >= this.threshold && localResult.label !== 'unknown') {
      return { ...localResult, usedServer: false };
    }

    const serverResult = await this.server.detect(frame);
    return { ...serverResult, usedServer: true };
  }

  async dispose() {
    await this.local.dispose();
  }
}
