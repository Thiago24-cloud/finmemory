import { randomBytes } from 'crypto';

/**
 * Senha inicial legível (12 chars) para e-mail de acesso ao painel.
 * Ex.: Fm-a7k2m9xqp1
 */
export function generateInitialPassword() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(10);
  let body = '';
  for (let i = 0; i < 10; i += 1) {
    body += alphabet[bytes[i] % alphabet.length];
  }
  return `Fm-${body}`;
}
