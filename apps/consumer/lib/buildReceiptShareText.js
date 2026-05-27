function formatCurrency(value) {
  if (value == null || Number.isNaN(Number(value))) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));
}

function isSupabaseOrAppStorageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const u = url.toLowerCase();
  return u.includes('supabase') && u.includes('/storage/');
}

/**
 * Texto para colar no WhatsApp com resumo da compra / nota.
 * @param {object} transaction — linha de transacoes (+ produtos opcional)
 * @param {{ maxLineItems?: number }} opts
 */
export function buildReceiptShareText(transaction, opts = {}) {
  const maxLineItems = opts.maxLineItems ?? 20;
  const t = transaction || {};
  const lines = [];

  lines.push('*Comprovante — FinMemory*');
  lines.push('');
  lines.push(`*Estabelecimento:* ${(t.estabelecimento || '—').trim() || '—'}`);

  if (t.data) {
    try {
      const d = new Date(String(t.data).slice(0, 10) + 'T12:00:00');
      const dateStr = d.toLocaleDateString('pt-BR');
      const timePart = t.hora ? ` às ${String(t.hora).slice(0, 5)}` : '';
      lines.push(`*Data:* ${dateStr}${timePart}`);
    } catch {
      lines.push(`*Data:* ${t.data}`);
    }
  }

  lines.push(`*Total:* ${formatCurrency(t.total)}`);
  if (t.categoria) lines.push(`*Categoria:* ${t.categoria}`);
  if (t.forma_pagamento) lines.push(`*Pagamento:* ${t.forma_pagamento}`);
  if (t.endereco) lines.push(`*Local:* ${t.endereco}`);

  const produtos = Array.isArray(t.produtos) ? t.produtos : [];
  if (produtos.length > 0) {
    lines.push('');
    lines.push('*Itens:*');
    produtos.slice(0, maxLineItems).forEach((p) => {
      const desc = (p.descricao || 'Item').trim();
      lines.push(`• ${desc} — ${formatCurrency(p.valor_total)}`);
    });
    if (produtos.length > maxLineItems) {
      lines.push(`… e mais ${produtos.length - maxLineItems} item(ns).`);
    }
  }

  const receiptUrl = (t.receipt_image_url || '').trim();
  if (receiptUrl && /^https?:\/\//i.test(receiptUrl)) {
    if (!isSupabaseOrAppStorageUrl(receiptUrl)) {
      lines.push('');
      lines.push(`*Consulta da nota (link oficial):*\n${receiptUrl}`);
    }
  }

  return lines.join('\n');
}

export function whatsAppShareUrl(text) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
