/**
 * Credenciais Pluggy (servidor apenas). Lidas em runtime — não usar em Client Components.
 *
 * Cloud Run / .env.local:
 * - PLUGGY_CLIENT_ID
 * - PLUGGY_CLIENT_SECRET
 * - PLUGGY_WEBHOOK_SECRET (opcional; se vazio, webhook aceita POST sem validar header)
 */

export function pluggyClientId() {
  return process.env.PLUGGY_CLIENT_ID?.trim() || '';
}

export function pluggyClientSecret() {
  return process.env.PLUGGY_CLIENT_SECRET?.trim() || '';
}

export function pluggyWebhookSecret() {
  return process.env.PLUGGY_WEBHOOK_SECRET?.trim() || '';
}

/** Alias legível para quem prefere nomes em bloco único. */
export function readPluggyEnv() {
  return {
    CLIENT_ID: pluggyClientId(),
    CLIENT_SECRET: pluggyClientSecret(),
    WEBHOOK_SECRET: pluggyWebhookSecret(),
  };
}
