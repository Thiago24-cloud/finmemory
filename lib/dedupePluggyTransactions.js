import { normalizePluggyMoney } from './pluggyMoney.js';

/**
 * Remove duplicatas óbvias de transações Pluggy (mesmo dia, valor, estabelecimento),
 * preferindo linhas com `pluggy_transaction_id` e melhor `source`.
 * @param {unknown[]} rows
 * @returns {unknown[]}
 */
export function dedupePluggyTransactions(rows) {
  if (!Array.isArray(rows) || rows.length < 2) return Array.isArray(rows) ? rows : [];

  const normalizeMerchant = (value) =>
    String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const sourceScore = (row) => {
    const source = String(row?.source || '').toLowerCase();
    if (source === 'pluggy') return 4;
    if (Array.isArray(row?.produtos) && row.produtos.length > 0) return 3;
    if (source === 'ocr' || source === 'gmail') return 2;
    return 1;
  };

  const withMeta = rows
    .map((row) => {
      const source = String(row?.source || '').toLowerCase();
      const totalRaw = Number(row?.total) || 0;
      const total = source === 'pluggy' ? normalizePluggyMoney(totalRaw) : totalRaw;
      const date = String(row?.data || '').slice(0, 10);
      const hora = String(row?.hora || '').slice(0, 8);
      const hasTime = /^\d{2}:\d{2}:\d{2}$/.test(hora);
      const dateTime = new Date(`${date}T${hasTime ? hora : '12:00:00'}`);
      const ts = Number.isNaN(dateTime.getTime()) ? 0 : dateTime.getTime();
      const merchant = normalizeMerchant(row?.estabelecimento);
      const pluggyId = row?.pluggy_transaction_id != null ? String(row.pluggy_transaction_id) : '';
      return { row: { ...row, total }, source, total, date, hora, hasTime, ts, merchant, pluggyId };
    })
    .sort((a, b) => {
      const ds = sourceScore(b.row) - sourceScore(a.row);
      if (ds !== 0) return ds;
      return b.ts - a.ts;
    });

  const kept = [];
  for (const cand of withMeta) {
    const duplicate = kept.some((k) => {
      if (cand.pluggyId && k.pluggyId && cand.pluggyId === k.pluggyId) return true;
      if (!cand.date || cand.date !== k.date) return false;
      if (Math.abs(Math.abs(cand.total) - Math.abs(k.total)) > 0.03) return false;
      if (cand.merchant && k.merchant && cand.merchant !== k.merchant) return false;
      if (cand.hasTime && k.hasTime) {
        const diffMs = Math.abs(cand.ts - k.ts);
        if (diffMs > 1000 * 60 * 120) return false;
      }
      return true;
    });
    if (!duplicate) kept.push(cand);
  }

  return kept
    .map((x) => x.row)
    .sort((a, b) => {
      const ad = new Date(`${String(a?.data || '').slice(0, 10)}T${String(a?.hora || '').slice(0, 8) || '12:00:00'}`);
      const bd = new Date(`${String(b?.data || '').slice(0, 10)}T${String(b?.hora || '').slice(0, 8) || '12:00:00'}`);
      return bd.getTime() - ad.getTime();
    });
}
