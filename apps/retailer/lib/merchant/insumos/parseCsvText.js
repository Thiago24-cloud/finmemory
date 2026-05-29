/**
 * Parser CSV simples (suporta aspas e separador , ou ;).
 * @param {string} text
 * @returns {{ headers: string[], rows: string[][] }}
 */
export function parseCsvText(text) {
  const raw = String(text || '').replace(/^\uFEFF/, '').trim();
  if (!raw) return { headers: [], rows: [] };

  const lines = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '"') {
      if (inQuotes && raw[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && raw[i + 1] === '\n') i++;
      if (cur.trim()) lines.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) lines.push(cur);

  const splitLine = (line) => {
    const sep = line.includes(';') && !line.includes(',') ? ';' : ',';
    const cells = [];
    let cell = '';
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (q && line[i + 1] === '"') {
          cell += '"';
          i++;
        } else q = !q;
      } else if (c === sep && !q) {
        cells.push(cell.trim());
        cell = '';
      } else cell += c;
    }
    cells.push(cell.trim());
    return cells;
  };

  const parsed = lines.map(splitLine).filter((r) => r.some((c) => c));
  if (!parsed.length) return { headers: [], rows: [] };

  const headers = parsed[0];
  const rows = parsed.slice(1);
  return { headers, rows };
}

/**
 * Aplica mapeamento de colunas às linhas brutas.
 */
export function applyColumnMapping(rows, headers, mapping) {
  const colIndex = {};
  for (const [field, colName] of Object.entries(mapping || {})) {
    if (!colName) continue;
    const idx = headers.findIndex((h) => h === colName);
    if (idx >= 0) colIndex[field] = idx;
  }

  return rows.map((cells, rowIndex) => {
    const out = { _row: rowIndex + 2 };
    for (const field of Object.keys(colIndex)) {
      out[field] = cells[colIndex[field]] ?? '';
    }
    return out;
  });
}
