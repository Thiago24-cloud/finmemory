const MAX_REJECTIONS = 50;
/** @type {Array<{ timestamp: string, provider: string, field: string, reason: string, runId?: string | null, productName?: string | null }>} */
const rejectionBuffer = [];

export function pushIngestRejection(entry) {
  rejectionBuffer.unshift({
    timestamp: new Date().toISOString(),
    provider: String(entry?.provider || 'unknown'),
    field: String(entry?.field || 'unknown'),
    reason: String(entry?.reason || 'unknown'),
    runId: entry?.runId || null,
    productName: entry?.productName || null,
  });
  if (rejectionBuffer.length > MAX_REJECTIONS) rejectionBuffer.length = MAX_REJECTIONS;
}

export function getLatestIngestRejections(limit = 5) {
  const safe = Math.max(1, Math.min(50, Number(limit) || 5));
  return rejectionBuffer.slice(0, safe);
}

