/**
 * Contratos do pipeline de visão computacional (estoque lojista).
 *
 * @typedef {'local' | 'server'} DetectionSource
 *
 * @typedef {Object} VisionDetection
 * @property {string} label — nome/classe retornado pelo modelo
 * @property {number} confidence — 0..1
 * @property {DetectionSource} source
 * @property {string} [insumoId] — preenchido após match no cache local
 * @property {string} [ean]
 * @property {string} [sku]
 * @property {number} [inferenceMs]
 *
 * @typedef {Object} VisionFrame
 * @property {HTMLCanvasElement | HTMLVideoElement | ImageBitmap} source
 * @property {number} width
 * @property {number} height
 * @property {number} capturedAt
 */

/** Confiança mínima para aceitar detecção local sem ir à nuvem. */
export const LOCAL_CONFIDENCE_THRESHOLD = 0.72;

/** Intervalo mínimo entre inferências (ms) — evita saturar CPU/GPU. */
export const FRAME_SAMPLE_INTERVAL_MS = 280;

/** Debounce por label detectada (ms). */
export const DETECTION_DEBOUNCE_MS = 2200;
