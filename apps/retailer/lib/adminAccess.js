/**
 * Painel operacional /admin — quem pode entrar.
 *
 * FINMEMORY_ADMIN_EMAILS — e-mails separados por vírgula ou ponto e vírgula (case-insensitive).
 * Se estiver vazio ou não definido, as rotas /admin mantêm o comportamento anterior (canAccess).
 */

/**
 * @returns {string[]} e-mails normalizados em minúsculas
 */
export function parseFinmemoryAdminEmailsFromEnv() {
  const raw = process.env.FINMEMORY_ADMIN_EMAILS;
  if (raw == null || typeof raw !== 'string') return [];
  const parts = raw
    .split(/[,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return parts;
}

/**
 * Lista explícita de admins configurada?
 */
export function hasFinmemoryAdminAllowlist() {
  return parseFinmemoryAdminEmailsFromEnv().length > 0;
}

/**
 * @param {string | null | undefined} email
 * @returns {boolean}
 */
export function isFinmemoryAdminEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const list = parseFinmemoryAdminEmailsFromEnv();
  if (list.length === 0) return false;
  return list.includes(email.trim().toLowerCase());
}

/**
 * Servidor: acesso a /admin/* quando há lista explícita só admins; senão fallback canAccess.
 * @param {string | null | undefined} email
 * @param {() => Promise<boolean>} canAccessFn
 */
export async function canAccessAdminRoutes(email, canAccessFn) {
  if (hasFinmemoryAdminAllowlist()) {
    return isFinmemoryAdminEmail(email);
  }
  if (typeof canAccessFn === 'function') {
    return canAccessFn(email);
  }
  return false;
}
