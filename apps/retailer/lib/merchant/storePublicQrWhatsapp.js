/** Normaliza WhatsApp BR para dígitos com 55. */
export function normalizeWhatsappDigits(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length >= 12 && digits.startsWith('55')) return digits.slice(0, 13);
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits.slice(0, 13);
}
