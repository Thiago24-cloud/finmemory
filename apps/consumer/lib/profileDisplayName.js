/**
 * Detecta se `name` em public.users ainda é só placeholder (cadastro antigo / signup padrão).
 * Nesses casos o utilizador deve ver o questionário pelo menos uma vez.
 *
 * @param {string | null | undefined} name
 * @param {string | null | undefined} email
 */
export function isPlaceholderDisplayName(name, email) {
  const n = String(name || '').trim();
  const em = String(email || '').trim().toLowerCase();
  if (!n) return true;
  if (n.includes('@')) return true;
  if (!em) return false;
  if (n.toLowerCase() === em) return true;
  const at = em.indexOf('@');
  const local = at > 0 ? em.slice(0, at) : em;
  if (local && n.toLowerCase() === local) return true;
  return false;
}

/**
 * @param {{ name?: string | null, profile_first_login_completed_at?: string | null }} row
 * @param {string | undefined} email — email da sessão
 */
export function needsProfileFirstLogin(row, email) {
  if (!row) return true;
  if (isPlaceholderDisplayName(row.name, email)) return true;
  if (!row.profile_first_login_completed_at) return true;
  return false;
}
