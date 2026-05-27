/**
 * Mensagem legível para erros das APIs /api/merchant/* no painel.
 * @param {Response | null | undefined} res
 * @param {{ error?: string; code?: string; message?: string } | null | undefined} data
 * @param {string} fallback
 */
export function formatMerchantApiError(res, data, fallback) {
  const msg = data?.error || data?.message || fallback;
  const code = data?.code ? ` [${data.code}]` : '';
  const http = res?.status ? ` (HTTP ${res.status})` : '';
  return `${msg}${code}${http}`;
}

/**
 * @param {string} label
 * @param {Response} res
 * @param {Record<string, unknown>} [data]
 */
export function logMerchantApiFailure(label, res, data) {
  if (typeof window === 'undefined') return;
  if (process.env.NODE_ENV !== 'development') return;
  console.warn(`[MerchantPanel] ${label}`, { status: res.status, ...(data || {}) });
}
