/** Validação GS1 para leituras de código de barras no painel lojista. */

export function digitsOnly(s) {
  return String(s || '').replace(/\D/g, '');
}

function checkDigitEan13(first12) {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const n = parseInt(first12[i], 10);
    if (Number.isNaN(n)) return -1;
    sum += i % 2 === 0 ? n : n * 3;
  }
  return (10 - (sum % 10)) % 10;
}

function checkDigitEan8(first7) {
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    const n = parseInt(first7[i], 10);
    if (Number.isNaN(n)) return -1;
    sum += i % 2 === 0 ? n * 3 : n;
  }
  return (10 - (sum % 10)) % 10;
}

export function isValidEan13(code) {
  const d = digitsOnly(code);
  if (d.length !== 13) return false;
  return checkDigitEan13(d.slice(0, 12)) === parseInt(d[12], 10);
}

export function isValidEan8(code) {
  const d = digitsOnly(code);
  if (d.length !== 8) return false;
  return checkDigitEan8(d.slice(0, 7)) === parseInt(d[7], 10);
}

export function isValidUpcA(code) {
  const d = digitsOnly(code);
  if (d.length !== 12) return false;
  return isValidEan13(`0${d}`);
}

export function isValidRetailBarcode(digits) {
  const d = digitsOnly(digits);
  if (d.length === 13) return isValidEan13(d);
  if (d.length === 12) return isValidUpcA(d);
  if (d.length === 8) return isValidEan8(d);
  return false;
}

export function extractRetailBarcodeFromScan(text) {
  const raw = String(text || '').trim();
  let d = digitsOnly(raw);
  if (isValidRetailBarcode(d)) return d;
  const candidates = raw.match(/\d{8,14}/g);
  if (candidates) {
    for (const c of candidates) {
      d = digitsOnly(c);
      if (isValidRetailBarcode(d)) return d;
    }
  }
  return null;
}
