/** Apenas dígitos de CPF (11) ou CNPJ (14). */
export function normalizeTaxIdDigits(value: string | null | undefined): string {
  return String(value || '').replace(/\D/g, '');
}

export function isValidCpfOrCnpj(value: string | null | undefined): boolean {
  const d = normalizeTaxIdDigits(value);
  return d.length === 11 || d.length === 14;
}

export function formatTaxIdDisplay(value: string | null | undefined): string {
  const d = normalizeTaxIdDigits(value);
  if (d.length === 11) {
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  if (d.length === 14) {
    return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return d;
}
