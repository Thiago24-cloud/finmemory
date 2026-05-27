const windows = new Map();

function getWindow(key, now, windowMs) {
  const current = windows.get(key);
  if (!current || current.expiresAt <= now) {
    const next = { count: 0, expiresAt: now + windowMs };
    windows.set(key, next);
    return next;
  }
  return current;
}

export function checkRateLimit({ bucket, key, limit, windowMs }) {
  const now = Date.now();
  const state = getWindow(`${bucket}:${key}`, now, windowMs);
  state.count += 1;
  const retryAfterMs = Math.max(0, state.expiresAt - now);
  return {
    allowed: state.count <= limit,
    remaining: Math.max(0, limit - state.count),
    retryAfterMs,
  };
}

export function getRequestIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length) return xff.split(',')[0].trim();
  if (Array.isArray(xff) && xff[0]) return String(xff[0]).split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}
