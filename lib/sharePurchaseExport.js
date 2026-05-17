/**
 * Exporta compra / nota fiscal para planilha (CSV) e PDF — compartilhamento nativo (Share Sheet).
 */

function tryParseJsonArray(raw) {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function escapeCsvCell(value) {
  const raw = value == null ? '' : String(value);
  if (/[",;\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function formatBrl(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatBrlCsv(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '';
  return v.toFixed(2).replace('.', ',');
}

function formatDateBr(iso) {
  if (!iso) return '';
  try {
    const d = new Date(String(iso).slice(0, 10) + 'T12:00:00');
    return d.toLocaleDateString('pt-BR');
  } catch {
    return String(iso).slice(0, 10);
  }
}

/**
 * @param {object} source — transação salva, formData do OCR ou rascunho
 */
export function normalizePurchaseForExport(source) {
  const t = source || {};
  const items = [];

  const rawItems = t.items;
  const jsonItems =
    Array.isArray(rawItems) ? rawItems : typeof rawItems === 'string' ? tryParseJsonArray(rawItems) : [];

  if (Array.isArray(t.produtos) && t.produtos.length > 0) {
    for (const p of t.produtos) {
      const vt = Number(p.valor_total ?? p.price) || 0;
      const q = Number(p.quantidade) || 1;
      const vu = Number(p.valor_unitario);
      items.push({
        descricao: String(p.descricao || p.name || 'Item').trim() || 'Item',
        quantidade: q,
        valor_unitario: Number.isFinite(vu) ? vu : q > 0 ? vt / q : vt,
        valor_total: vt,
        unidade: p.unidade || 'UN',
      });
    }
  } else if (jsonItems.length > 0) {
    for (const it of jsonItems) {
      const vt = Number(it.price ?? it.valor_total ?? it.valor) || 0;
      const q = Number(it.quantidade) || 1;
      items.push({
        descricao: String(it.name ?? it.descricao ?? 'Item').trim() || 'Item',
        quantidade: q,
        valor_unitario: Number(it.valor_unitario) || (q > 0 ? vt / q : vt),
        valor_total: vt,
        unidade: it.unidade || 'UN',
      });
    }
  }

  const itemsSum = items.reduce((s, i) => s + (Number(i.valor_total) || 0), 0);
  const total = Number(t.total ?? t.total_amount);
  const resolvedTotal = Number.isFinite(total) && total > 0 ? total : itemsSum;

  return {
    id: t.id || null,
    estabelecimento: String(t.estabelecimento || t.merchant_name || '').trim(),
    data: (t.data || t.date || '').toString().slice(0, 10),
    hora: t.hora ? String(t.hora).slice(0, 8) : '',
    cnpj: t.cnpj || t.merchant_cnpj || '',
    categoria: t.categoria || t.category || '',
    forma_pagamento: t.forma_pagamento || t.payment_method || '',
    endereco: t.endereco || t.merchant_address || '',
    total: resolvedTotal,
    items,
  };
}

/** Planilha organizada (metadados + itens) — separador `;` para Excel BR */
export function buildPurchaseCsv(purchase) {
  const p = purchase || normalizePurchaseForExport({});
  const lines = [];

  lines.push('FinMemory;Compra / Nota fiscal');
  lines.push(`Estabelecimento;${escapeCsvCell(p.estabelecimento || '—')}`);
  if (p.data) lines.push(`Data;${escapeCsvCell(formatDateBr(p.data))}`);
  if (p.hora) lines.push(`Hora;${escapeCsvCell(p.hora.slice(0, 5))}`);
  if (p.cnpj) lines.push(`CNPJ;${escapeCsvCell(p.cnpj)}`);
  if (p.categoria) lines.push(`Categoria;${escapeCsvCell(p.categoria)}`);
  if (p.forma_pagamento) lines.push(`Pagamento;${escapeCsvCell(p.forma_pagamento)}`);
  if (p.endereco) lines.push(`Endereço;${escapeCsvCell(p.endereco)}`);
  lines.push(`Total da compra;${escapeCsvCell(formatBrlCsv(p.total))}`);
  lines.push('');

  lines.push(['Descrição', 'Quantidade', 'Unidade', 'Valor unitário', 'Valor total'].join(';'));
  for (const item of p.items) {
    lines.push(
      [
        escapeCsvCell(item.descricao),
        escapeCsvCell(item.quantidade),
        escapeCsvCell(item.unidade || 'UN'),
        escapeCsvCell(formatBrlCsv(item.valor_unitario)),
        escapeCsvCell(formatBrlCsv(item.valor_total)),
      ].join(';')
    );
  }

  if (p.items.length === 0) {
    lines.push('—;—;—;—;—');
  }

  return lines.join('\r\n');
}

export function purchaseExportFilename(purchase, ext = 'csv') {
  const p = purchase || {};
  const slug = String(p.estabelecimento || 'compra')
    .replace(/[^\w\u00C0-\u024f]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
  const d = p.data ? p.data.replace(/-/g, '') : new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `finmemory_${slug || 'compra'}_${d}.${ext}`;
}

function downloadBlobFallback(blob, filename) {
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

async function shareFile(blob, filename, title, mime) {
  if (typeof window === 'undefined') return 'cancelled';
  const file = new File([blob], filename, { type: mime });
  if (typeof navigator.share === 'function') {
    try {
      const payload = { files: [file], title };
      if (typeof navigator.canShare === 'function' && !navigator.canShare(payload)) {
        throw new Error('cannot-share-file');
      }
      await navigator.share(payload);
      return 'shared';
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled';
    }
  }
  downloadBlobFallback(blob, filename);
  return 'fallback';
}

/**
 * @returns {'shared' | 'cancelled' | 'fallback'}
 */
export async function sharePurchaseCsv(source, options = {}) {
  const purchase = normalizePurchaseForExport(source);
  const csv = buildPurchaseCsv(purchase);
  const filename = options.filename || purchaseExportFilename(purchase, 'csv');
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
  return shareFile(blob, filename, options.title || 'Compra FinMemory', 'text/csv');
}

/**
 * Gera PDF da compra (itens + totais).
 * @returns {Promise<Blob>}
 */
export async function buildPurchasePdfBlob(source) {
  const purchase = normalizePurchaseForExport(source);
  const { jsPDF } = await import('jspdf');

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 14;
  let y = margin;
  const pageW = doc.internal.pageSize.getWidth();
  const maxW = pageW - margin * 2;

  const line = (text, opts = {}) => {
    const size = opts.size || 10;
    const bold = opts.bold || false;
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(String(text || ''), maxW);
    for (const ln of lines) {
      if (y > 280) {
        doc.addPage();
        y = margin;
      }
      doc.text(ln, margin, y);
      y += size * 0.45 + 2;
    }
  };

  line('FinMemory — Comprovante de compra', { size: 14, bold: true });
  y += 2;
  line(purchase.estabelecimento || 'Estabelecimento', { size: 12, bold: true });
  if (purchase.data) line(`Data: ${formatDateBr(purchase.data)}${purchase.hora ? ` · ${purchase.hora.slice(0, 5)}` : ''}`);
  if (purchase.cnpj) line(`CNPJ: ${purchase.cnpj}`);
  if (purchase.categoria) line(`Categoria: ${purchase.categoria}`);
  if (purchase.forma_pagamento) line(`Pagamento: ${purchase.forma_pagamento}`);
  if (purchase.endereco) line(`Local: ${purchase.endereco}`);
  y += 4;

  line('Itens', { size: 11, bold: true });
  y += 1;

  if (purchase.items.length === 0) {
    line('Nenhum item detalhado na nota.');
  } else {
    for (const item of purchase.items) {
      const head = `${item.descricao}  ·  ${formatBrl(item.valor_total)}`;
      line(head, { bold: true, size: 10 });
      const sub = `Qtd: ${item.quantidade} ${item.unidade || 'UN'}  ·  Unit.: ${formatBrl(item.valor_unitario)}`;
      line(sub, { size: 9 });
      y += 1;
    }
  }

  y += 3;
  line(`Total: ${formatBrl(purchase.total)}`, { size: 13, bold: true });
  y += 4;
  line('Gerado pelo FinMemory — valores extraídos da nota fiscal.', { size: 8 });

  return doc.output('blob');
}

/**
 * @returns {'shared' | 'cancelled' | 'fallback'}
 */
export async function sharePurchasePdf(source, options = {}) {
  const purchase = normalizePurchaseForExport(source);
  const blob = await buildPurchasePdfBlob(purchase);
  const filename = options.filename || purchaseExportFilename(purchase, 'pdf');
  return shareFile(blob, filename, options.title || 'Compra FinMemory', 'application/pdf');
}
