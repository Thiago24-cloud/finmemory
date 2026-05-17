/**
 * Gera CSV de inventário varejista e dispara Share nativo (Web Share API + arquivo).
 */

export type RetailInventoryCsvRow = {
  ean: string;
  nome: string;
  quantidade: number;
  preco: number | null;
};

function escapeCsvCell(value: string | number | null | undefined): string {
  const raw = value == null ? '' : String(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

/** Cabeçalho: EAN, Nome, Quantidade, Preço */
export function buildRetailInventoryCsv(rows: RetailInventoryCsvRow[]): string {
  const lines = ['EAN,Nome,Quantidade,Preco'];
  for (const row of rows) {
    const preco =
      row.preco != null && Number.isFinite(Number(row.preco))
        ? Number(row.preco).toFixed(2).replace('.', ',')
        : '';
    lines.push(
      [
        escapeCsvCell(row.ean),
        escapeCsvCell(row.nome),
        escapeCsvCell(row.quantidade),
        escapeCsvCell(preco),
      ].join(',')
    );
  }
  return lines.join('\r\n');
}

/** `entrada_estoque_DD-MM-YYYY.csv` */
export function retailInventoryCsvFilename(date: Date = new Date()): string {
  const d = date;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `entrada_estoque_${dd}-${mm}-${yyyy}.csv`;
}

function downloadCsvFallback(csv: string, filename: string): void {
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Share Sheet com arquivo CSV (WhatsApp Web, e-mail, Drive, etc.).
 * @returns shared = usuário concluiu share; cancelled = fechou; fallback = download/cópia
 */
export async function shareRetailInventoryCsv(
  rows: RetailInventoryCsvRow[],
  options?: { filename?: string; title?: string }
): Promise<'shared' | 'cancelled' | 'fallback'> {
  if (typeof window === 'undefined') {
    return 'cancelled';
  }

  const csv = buildRetailInventoryCsv(rows);
  const filename = options?.filename || retailInventoryCsvFilename();
  const title = options?.title || 'Inventário FinMemory';

  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
  const file = new File([blob], filename, { type: 'text/csv' });

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      const filePayload = { files: [file], title };
      if (typeof navigator.canShare === 'function' && navigator.canShare(filePayload)) {
        await navigator.share(filePayload);
        return 'shared';
      }
      const textPayload = {
        title,
        text: `Inventário — ${filename}\n\n${csv.slice(0, 4000)}`,
      };
      if (typeof navigator.canShare !== 'function' || navigator.canShare(textPayload)) {
        await navigator.share(textPayload);
        return 'shared';
      }
    } catch (e) {
      const err = e as { name?: string };
      if (err?.name === 'AbortError') return 'cancelled';
    }
  }

  downloadCsvFallback(csv, filename);
  try {
    await navigator.clipboard.writeText(csv);
  } catch {
    /* ignore */
  }

  return 'fallback';
}
