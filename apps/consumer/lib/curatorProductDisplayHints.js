/**
 * Extrai pistas de embalagem / medida do nome completo — só para UI do curador.
 * O nome na base de dados não é alterado.
 */
export function extractProductSpecHintsForDisplay(fullName) {
  const s = String(fullName || '');
  const found = [];
  const seen = new Set();
  const patterns = [
    /\b\d+[,.]?\d*\s*(g|kg|gr|ml|l|lt|lts)\b/gi,
    /\bCAIXA\s+\d+\s*G?\b/gi,
    /\bFRASCO\s+\d+\s*(ML|L|LT)?\b/gi,
    /\bEMBALAGEM\s+\d+\s*G?\b/gi,
    /\bPCT\.?\s*\d+[,.]?\d*\s*(KG|G)\b/gi,
    /\bSACH[EÊ]\s+\d+\s*G\b/gi,
    /\b\d+\s*X\s*\d+\s*(G|ML|L)\b/gi,
    /\bLEVE\s+\d+\s+PAGUE\s+\d+\b/gi,
  ];
  for (const re of patterns) {
    const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`;
    const r = new RegExp(re.source, flags);
    let m;
    while ((m = r.exec(s)) !== null) {
      const t = m[0].trim().replace(/\s+/g, ' ');
      const k = t.toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        found.push(t);
      }
    }
  }
  return found.slice(0, 8);
}
