/**
 * Decodifica saída de classificador ONNX (logits → label + confiança).
 *
 * @param {Float32Array | number[]} logits
 * @param {{ classes: Array<{ label: string, ean?: string }> }} labelsMeta
 */
export function decodeClassificationOutput(logits, labelsMeta) {
  const classes = labelsMeta?.classes || [];
  const arr = logits instanceof Float32Array ? Array.from(logits) : logits;
  if (!arr.length) {
    return { label: 'unknown', confidence: 0, ean: null, classIndex: -1 };
  }

  const probs = softmax(arr);
  let bestIdx = 0;
  let best = probs[0];
  for (let i = 1; i < probs.length; i += 1) {
    if (probs[i] > best) {
      best = probs[i];
      bestIdx = i;
    }
  }

  const entry = classes[bestIdx];
  if (!entry) {
    return { label: 'unknown', confidence: best, ean: null, classIndex: bestIdx };
  }

  return {
    label: entry.label,
    confidence: best,
    ean: entry.ean || null,
    classIndex: bestIdx,
  };
}

function softmax(logits) {
  const max = Math.max(...logits);
  const exps = logits.map((x) => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}
