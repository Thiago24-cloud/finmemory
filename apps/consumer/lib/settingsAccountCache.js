const KEY = 'finmemory_settings_account_v1';
const MAX_AGE_MS = 5 * 60 * 1000;

/**
 * Cache leve (sessionStorage) para «Privacidade e conta»: mostra XP/assinatura
 * na volta à página sem esperar sync Stripe + update() da sessão.
 */
export function readSettingsAccountCache(userKey) {
  if (typeof window === 'undefined' || !userKey) return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || o.userKey !== userKey || typeof o.t !== 'number') return null;
    if (Date.now() - o.t > MAX_AGE_MS) return null;
    if (!o.xp || typeof o.xp !== 'object' || !o.sub || typeof o.sub !== 'object') return null;
    return { xp: o.xp, sub: o.sub };
  } catch {
    return null;
  }
}

export function writeSettingsAccountCache(userKey, xp, sub) {
  if (typeof window === 'undefined' || !userKey || !xp || !sub) return;
  try {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({
        userKey,
        t: Date.now(),
        xp,
        sub,
      })
    );
  } catch {
    /* quota / private mode */
  }
}
