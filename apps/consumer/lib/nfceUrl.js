/**
 * Extrai a chave de 44 dígitos do texto do QR (URL longa, só números, ou números no meio do texto).
 */
export function extractChave44(raw) {
  if (raw == null || typeof raw !== 'string') return null;
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  const digitsOnly = trimmed.replace(/\D/g, '');
  if (digitsOnly.length === 44) return digitsOnly;
  const m44 = trimmed.match(/\b\d{44}\b/);
  if (m44) return m44[0];
  const long = trimmed.match(/\d{44}/);
  return long ? long[0] : null;
}

/**
 * Dígito verificador da chave de acesso NFC-e/NFe (43 primeiros dígitos → DV na posição 44).
 */
export function isValidChaveNfceDv44(chave44) {
  const d = String(chave44 || '').replace(/\D/g, '');
  if (d.length !== 44) return false;
  const base = d.slice(0, 43);
  const dv = parseInt(d[43], 10);
  if (Number.isNaN(dv)) return false;
  let soma = 0;
  let peso = 2;
  for (let i = 42; i >= 0; i--) {
    soma += parseInt(base[i], 10) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  let esperado = 11 - resto;
  if (esperado >= 10) esperado = 0;
  return esperado === dv;
}
