/**
 * Lista de e-mails quando o modo “beta restrito” está ligado (middleware, Credentials signIn, signup).
 *
 * Por defeito o app está **aberto**: qualquer e-mail válido pode cadastrar e entrar (limites de recurso continuam pelo plano, PlanGuard/usePlan).
 *
 * FINMEMORY_PUBLIC_ACCESS=1 ou true — garante modo aberto mesmo se outras variáveis forem adicionadas no futuro.
 * FINMEMORY_PRIVATE_BETA_EMAILS — se definido e não vazio, só esses e-mails (vírgula ou ponto e vírgula).
 * FINMEMORY_LOCKDOWN_SINGLE_USER=1 ou true — sem lista explícita, só **FINMEMORY_DEFAULT_LOCKDOWN_EMAIL** (comportamento antigo de pré-lançamento).
 */

/** Conta oficial — usado apenas com FINMEMORY_LOCKDOWN_SINGLE_USER. */
export const FINMEMORY_DEFAULT_LOCKDOWN_EMAIL = 'finmemory.oficial@gmail.com';

/**
 * @param {string | undefined} envValue
 * @returns {string[] | null} lista normalizada em minúsculas, ou null se o valor for vazio
 */
export function parsePrivateBetaAllowlist(envValue) {
  if (envValue == null || typeof envValue !== 'string') return null;
  const trimmed = envValue.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/[,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
  return parts.length > 0 ? parts : null;
}

/**
 * @returns {string[] | null} null = sem filtro por e-mail (modo público); array = só estes e-mails
 */
export function getPrivateBetaAllowlistFromEnv() {
  if (process.env.FINMEMORY_PUBLIC_ACCESS === 'true' || process.env.FINMEMORY_PUBLIC_ACCESS === '1') {
    return null;
  }
  const explicit = parsePrivateBetaAllowlist(process.env.FINMEMORY_PRIVATE_BETA_EMAILS);
  if (explicit) return explicit;
  if (
    process.env.FINMEMORY_LOCKDOWN_SINGLE_USER === 'true' ||
    process.env.FINMEMORY_LOCKDOWN_SINGLE_USER === '1'
  ) {
    return [FINMEMORY_DEFAULT_LOCKDOWN_EMAIL.trim().toLowerCase()];
  }
  return null;
}

/**
 * @param {string | null | undefined} email
 * @param {string[] | null} allowlist
 */
export function isEmailAllowedInPrivateBeta(email, allowlist) {
  if (!allowlist) return true;
  if (!email || typeof email !== 'string') return false;
  return allowlist.includes(email.trim().toLowerCase());
}
