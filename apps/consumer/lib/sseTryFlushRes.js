/**
 * Cloud Run / Node: alguns stacks expõem res.flush() (ex. compressão) para não bufferizar SSE.
 * É best-effort — em muitos ambientes não existe e tudo bem.
 */
export function sseTryFlushRes(res) {
  if (!res || typeof res.flush !== 'function') return;
  try {
    res.flush();
  } catch {
    /* ignore */
  }
}
