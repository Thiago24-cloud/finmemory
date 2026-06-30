/**
 * Web Worker — inferência ONNX fora da thread principal (câmera fluida).
 */
import * as ort from 'onnxruntime-web';
import { preprocessBitmapToNchw } from '../onnx/preprocessBitmap';
import { decodeClassificationOutput } from '../onnx/decodeClassification';

/** @type {import('onnxruntime-web').InferenceSession | null} */
let session = null;
/** @type {Record<string, unknown> | null} */
let labelsMeta = null;
let inputName = 'images';
let outputName = 'logits';
let inputSize = 320;
let epUsed = 'wasm';

function configureOrt() {
  ort.env.wasm.wasmPaths = '/ort/';
  ort.env.wasm.numThreads =
    typeof self !== 'undefined' && self.crossOriginIsolated
      ? Math.min(4, Math.floor((navigator.hardwareConcurrency || 2) / 2) || 2)
      : 1;
}

async function pickExecutionProviders() {
  try {
    const gpu = globalThis.navigator?.gpu;
    if (gpu) {
      const adapter = await gpu.requestAdapter();
      if (adapter) return ['webgpu', 'wasm'];
    }
  } catch {
    /* WebGPU indisponível */
  }
  return ['wasm'];
}

/**
 * @param {string} modelUrl
 */
async function createSession(modelUrl) {
  configureOrt();
  const executionProviders = await pickExecutionProviders();
  session = await ort.InferenceSession.create(modelUrl, {
    executionProviders,
    graphOptimizationLevel: 'all',
  });
  epUsed = executionProviders[0];

  const names = session.inputNames;
  const outNames = session.outputNames;
  if (names[0]) inputName = names[0];
  if (outNames[0]) outputName = outNames[0];

  // Warmup — primeira inferência é sempre mais lenta
  const dummy = new Float32Array(3 * inputSize * inputSize);
  const warmupTensor = new ort.Tensor('float32', dummy, [1, 3, inputSize, inputSize]);
  await session.run({ [inputName]: warmupTensor });
}

/**
 * @param {string} labelsUrl
 */
async function loadLabels(labelsUrl) {
  const res = await fetch(labelsUrl, { cache: 'force-cache' });
  if (!res.ok) throw new Error(`labels.json HTTP ${res.status}`);
  labelsMeta = await res.json();
  if (labelsMeta?.inputSize) inputSize = labelsMeta.inputSize;
  if (labelsMeta?.inputName) inputName = labelsMeta.inputName;
  if (labelsMeta?.outputName) outputName = labelsMeta.outputName;
}

/**
 * @param {ImageBitmap} bitmap
 */
async function runInference(bitmap) {
  if (!session || !labelsMeta) throw new Error('Worker não inicializado');

  const started = performance.now();
  const data = preprocessBitmapToNchw(bitmap, inputSize);
  const tensor = new ort.Tensor('float32', data, [1, 3, inputSize, inputSize]);
  const outputs = await session.run({ [inputName]: tensor });
  const outTensor = outputs[outputName] || outputs[session.outputNames[0]];
  const decoded = decodeClassificationOutput(outTensor.data, labelsMeta);

  return {
    label: decoded.label,
    confidence: decoded.confidence,
    ean: decoded.ean,
    classIndex: decoded.classIndex,
    inferenceMs: Math.round(performance.now() - started),
    epUsed,
  };
}

self.onmessage = async (event) => {
  const msg = event.data || {};

  try {
    if (msg.type === 'init') {
      await loadLabels(msg.labelsUrl);
      await createSession(msg.modelUrl);
      self.postMessage({
        type: 'ready',
        inputSize,
        inputName,
        outputName,
        epUsed,
        numThreads: ort.env.wasm.numThreads,
        classCount: labelsMeta?.classes?.length || 0,
      });
      return;
    }

    if (msg.type === 'infer') {
      const result = await runInference(msg.bitmap);
      self.postMessage({ type: 'result', id: msg.id, ...result });
      return;
    }

    if (msg.type === 'dispose') {
      session = null;
      labelsMeta = null;
      self.postMessage({ type: 'disposed' });
      return;
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      id: msg.id,
      message: error?.message || String(error),
    });
  }
};
