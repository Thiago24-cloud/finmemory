/**
 * Modo beta privado: lista de e-mails permitidos.
 * Usado no middleware (Edge) e em canAccess (servidor).
 *
 * Por defeito o app fica em lockdown: só **FINMEMORY_DEFAULT_LOCKDOWN_EMAIL** (valor no bundle).
 * Motivo: variáveis de ambiente em middleware/Edge nem sempre vêm do Cloud Run em runtime; o e-mail
 * fixo no código garante o bloqueio após deploy.
 *
 * FINMEMORY_PUBLIC_ACCESS=1 ou true — desliga a lista (qualquer utilizador aprovado em users/signups).
 * FINMEMORY_PRIVATE_BETA_EMAILS — se definido e não vazio, substitui o lockdown por defeito.
 * Vários e-mails: separados por vírgula ou ponto e vírgula.
 */

/** Conta oficial — único acesso até nova ordem (quando não há lista explícita nem modo público). */
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
  return [FINMEMORY_DEFAULT_LOCKDOWN_EMAIL.trim().toLowerCase()];
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
