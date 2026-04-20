/**
 * Junta movimentos Open Finance (Pluggy) com transações FinMemory (notas),
 * escondendo linhas do banco quando já existe nota correspondente (mesmo pluggy_transaction_id ou valor+data).
 */

/** Tolerância em BRL para considerar valor da nota igual ao do extrato (centavos arredondados). */
export const PLUGGY_AMOUNT_DATE_TOLERANCE = 0.03;

/**
 * @param {unknown} fmTotal
 * @param {unknown} ofAmount
 */
export function amountsMatchForPluggyPairing(fmTotal, ofAmount) {
  const ofAbs = Math.abs(Number(ofAmount) || 0);
  const fmAbs = Math.abs(Number(fmTotal) || 0);
  return Math.abs(ofAbs - fmAbs) <= PLUGGY_AMOUNT_DATE_TOLERANCE;
}

/**
 * Notas FinMemory candidatas ao mesmo dia e valor do movimento bancário (sem checar pluggy_transaction_id).
 * @param {object} ofTx
 * @param {object[]} fmList
 * @returns {object[]}
 */
export function findFinMemoryMatchesByAmountAndDate(ofTx, fmList) {
  const d = ofTx?.date;
  if (!d) return [];
  return (fmList || []).filter((fm) => {
    const fmDay = String(fm?.data || '').slice(0, 10);
    return fmDay === d && amountsMatchForPluggyPairing(fm.total, ofTx.amount);
  });
}

/** @param {string | undefined} iso */
export function getSortTimeForOpenFinance(t) {
  if (t?.created_at) {
    const x = new Date(t.created_at);
    if (!Number.isNaN(x.getTime())) return x.getTime();
  }
  const d = t?.date || '';
  return new Date(`${d}T12:00:00`).getTime();
}

/** @param {object} t transacao FinMemory */
export function getSortTimeForFinMemory(t) {
  if (t?.created_at) {
    const x = new Date(t.created_at);
    if (!Number.isNaN(x.getTime())) return x.getTime();
  }
  const d = String(t?.data || '').slice(0, 10);
  const h = (t?.hora && String(t.hora).slice(0, 8)) || '12:00:00';
  const x = new Date(`${d}T${h}`);
  return Number.isNaN(x.getTime()) ? 0 : x.getTime();
}

/**
 * @param {object} ofTx
 * @param {object[]} fmList
 * @param {Set<string>} fmUsedForAmountPairing ids de FM já emparelhados por valor+data com um OF
 * @returns {boolean}
 */
export function shouldHideOpenFinanceRow(ofTx, fmList, fmUsedForAmountPairing) {
  const pluggyOf = ofTx?.pluggy_transaction_id;
  if (pluggyOf) {
    for (const fm of fmList || []) {
      if (
        fm?.pluggy_transaction_id != null &&
        String(fm.pluggy_transaction_id) === String(pluggyOf)
      ) {
        fmUsedForAmountPairing.add(fm.id);
        return true;
      }
    }
  }
  const d = ofTx?.date;
  if (!d) return false;
  const ofAbs = Math.abs(Number(ofTx.amount) || 0);
  for (const fm of fmList || []) {
    if (fmUsedForAmountPairing.has(fm.id)) continue;
    const fmDay = String(fm?.data || '').slice(0, 10);
    if (fmDay !== d) continue;
    const fmAbs = Math.abs(Number(fm.total) || 0);
    if (Math.abs(ofAbs - fmAbs) <= PLUGGY_AMOUNT_DATE_TOLERANCE) {
      fmUsedForAmountPairing.add(fm.id);
      return true;
    }
  }
  return false;
}

/**
 * @param {object[] | null | undefined} openFinanceTxs
 * @param {object[] | null | undefined} finMemoryTxs
 * @returns {{ dateKey: string; items: { kind: 'openfinance' | 'finmemory'; data: object; sort: number }[] }[]}
 */
export function buildUnifiedHistoryGroups(openFinanceTxs, finMemoryTxs) {
  const ofList = Array.isArray(openFinanceTxs) ? openFinanceTxs : [];
  const fmList = Array.isArray(finMemoryTxs) ? finMemoryTxs : [];
  const fmUsedForAmountPairing = new Set();

  const visibleOf = [];
  for (const of of ofList) {
    if (shouldHideOpenFinanceRow(of, fmList, fmUsedForAmountPairing)) continue;
    visibleOf.push(of);
  }

  const dateKeys = new Set();
  for (const t of visibleOf) {
    if (t?.date) dateKeys.add(t.date);
  }
  for (const t of fmList) {
    const k = String(t?.data || '').slice(0, 10);
    if (k.length === 10) dateKeys.add(k);
  }

  const sortedDates = Array.from(dateKeys).sort((a, b) => b.localeCompare(a));

  return sortedDates
    .map((dateKey) => {
      const items = [];
      for (const fm of fmList) {
        if (String(fm?.data || '').slice(0, 10) === dateKey) {
          items.push({
            kind: 'finmemory',
            data: fm,
            sort: getSortTimeForFinMemory(fm),
          });
        }
      }
      for (const of of visibleOf) {
        if (of?.date === dateKey) {
          items.push({
            kind: 'openfinance',
            data: of,
            sort: getSortTimeForOpenFinance(of),
          });
        }
      }
      items.sort((a, b) => b.sort - a.sort);
      return { dateKey, items };
    })
    .filter((g) => g.items.length > 0);
}
