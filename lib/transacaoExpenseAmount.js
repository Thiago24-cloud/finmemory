/**
 * Entrada / crédito importado do Open Finance (não é gasto).
 * @param {object} row
 */
export function isTransacaoEntrada(row) {
  const forma = String(row?.forma_pagamento || '').toLowerCase();
  if (forma.includes('entrada')) return true;

  const source = String(row?.source || '').toLowerCase();
  if (source !== 'pluggy') return false;

  const cat = String(row?.categoria || '').toLowerCase();
  const desc = String(row?.estabelecimento || '').toLowerCase();
  const blob = `${cat} ${desc}`;
  if (/income|salary|sal[aá]rio|receb|deposit|cr[eé]dito|estorno|reversal|cashback/.test(blob)) {
    return true;
  }
  return false;
}

function isPluggyTransferOut(row) {
  const source = String(row?.source || '').toLowerCase();
  if (source !== 'pluggy') return false;
  const cat = String(row?.categoria || '').toLowerCase();
  const desc = String(row?.estabelecimento || '').toLowerCase();
  const blob = `${cat} ${desc}`;
  return /transfer|entre contas|ted\b|doc\b|pix enviado|envio pix/.test(blob);
}

/**
 * Valor em BRL para totais de **gastos** (dashboard, relatórios, carrossel de mês).
 * Ignora entradas Pluggy; NFC-e/OCR contam como despesa (valor absoluto).
 * @param {object} row
 */
export function getExpenseAmountForDashboard(row) {
  if (!row || isTransacaoEntrada(row) || isPluggyTransferOut(row)) return 0;

  const raw = Number(row?.total) || 0;
  const source = String(row?.source || '').toLowerCase();

  if (source === 'pluggy') {
    /* Já normalizado em pluggySyncTransactions ao gravar — não dividir de novo por 100. */
    return Math.abs(raw);
  }

  return Math.abs(raw);
}
