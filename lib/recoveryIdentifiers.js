/**
 * Identificadores de recuperação de conta (telefone Brasil / CPF).
 * Normalização determinística para busca única na tabela users.
 */

/** Valida dígitos verificadores do CPF (11 caracteres só números). */
export function cpfChecksumValid(digits11) {
  if (!/^\d{11}$/.test(digits11)) return false;
  if (/^(\d)\1{10}$/.test(digits11)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += Number(digits11[i]) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== Number(digits11[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i += 1) sum += Number(digits11[i]) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === Number(digits11[10]);
}

/** @returns {string | null} 11 dígitos ou null */
export function normalizeBrazilCpf(input) {
  if (input == null) return null;
  const raw = String(input).replace(/\D/g, '').slice(0, 14);
  if (raw.length !== 11) return null;
  if (!cpfChecksumValid(raw)) return null;
  return raw;
}

/**
 * Celular / fixo nacional: normaliza para 10–11 dígitos sem +55 ou com +55.
 * @returns {string | null} só dígitos (10 ou 11)
 */
export function normalizeBrazilPhoneDigits(input) {
  if (input == null) return null;
  let d = String(input).replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
  if (d.length > 11) d = d.slice(-11);
  if (d.length < 10 || d.length > 11) return null;
  return d;
}

/**
 * Mascarar email: local parcial + domínio.
 * Ex.: thumbnail@gmail.com → th***@gmail.com
 */
export function maskEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  const at = e.indexOf('@');
  if (at < 2) return '***';
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  if (!domain) return '***';
  const vis = Math.min(2, local.length);
  return `${local.slice(0, vis)}***@${domain}`;
}
