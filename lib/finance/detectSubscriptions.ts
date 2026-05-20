import { SUBSCRIPTION_KEYWORD_RULES, type SubscriptionKeywordRule } from './subscriptionKeywords';

/** Transação Pluggy ou linha espelhada em `bank_transactions`. */
export type PluggyTransactionLike = {
  id?: string | null;
  pluggy_transaction_id?: string | null;
  description?: string | null;
  descriptionRaw?: string | null;
  amount?: number | string | null;
  date?: string | Date | null;
  type?: string | null;
  category?: string | null;
  merchant?: { name?: string | null } | null;
};

export type DetectedSubscriptionConfidence = 'alta' | 'media' | 'baixa';

/** Saída pronta para API / confirmação do utilizador → `cobrancas`. */
export type DetectedSubscription = {
  /** Chave estável para UI e POST /confirm */
  id: string;
  nome_amigavel: string;
  valor: number;
  dia_cobranca_esperado: number | null;
  sugestao_assinatura: boolean;
  confianca: DetectedSubscriptionConfidence;
  categoria: string;
  keyword_match: string | null;
  repeticoes_meses: number;
  ultima_data: string | null;
  descricao_original: string;
  valor_minimo: number;
  valor_maximo: number;
  pluggy_transaction_ids: string[];
  /** Já existe cobrança manual com título parecido */
  ja_cadastrada: boolean;
};

export type DetectSubscriptionsOptions = {
  /** Títulos de cobranças já salvas (para marcar duplicatas) */
  existingCobrancaTitulos?: string[];
  /** Mínimo de meses distintos para heurística sem keyword (default 2) */
  minMonthsForRepetition?: number;
};

const NOISE_WORDS =
  /\b(PAGAMENTO|PAGTO|COMPRA|DEBITO|CREDITO|CARTAO|CARD|RECORRENTE|ASSINATURA|MENSAL|ANUIDADE)\b/g;

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function absAmount(amount: unknown): number {
  const n = Number(amount);
  return Number.isFinite(n) ? roundMoney(Math.abs(n)) : 0;
}

function toIsoDateOnly(d: unknown): string | null {
  if (d instanceof Date && !Number.isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  const s = String(d ?? '').trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function dayOfMonth(iso: string | null): number | null {
  if (!iso) return null;
  const m = iso.match(/^\d{4}-\d{2}-(\d{2})/);
  if (!m) return null;
  const d = parseInt(m[1], 10);
  return d >= 1 && d <= 31 ? d : null;
}

function monthKey(iso: string | null): string | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4}-\d{2})/);
  return m ? m[1] : null;
}

/** Normaliza descrição para matching (maiúsculas, sem acentos). */
export function normalizeSubscriptionDescription(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(NOISE_WORDS, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function txDescription(tx: PluggyTransactionLike): string {
  const parts = [
    tx.description,
    tx.descriptionRaw,
    tx.merchant?.name,
    tx.category,
  ]
    .filter((p) => p != null && String(p).trim() !== '')
    .map((p) => String(p).trim());
  return parts[0] || parts.join(' ') || '';
}

function txId(tx: PluggyTransactionLike): string {
  const id = tx.pluggy_transaction_id ?? tx.id;
  return id != null ? String(id) : '';
}

function isDebitExpense(tx: PluggyTransactionLike): boolean {
  const type = String(tx.type || '').toUpperCase();
  if (type === 'CREDIT') return false;
  const amt = Number(tx.amount);
  if (Number.isFinite(amt) && amt > 0 && type !== 'DEBIT') {
    /* Alguns conectores enviam débito positivo */
    return true;
  }
  if (type === 'DEBIT') return true;
  if (Number.isFinite(amt) && amt < 0) return true;
  return type !== 'CREDIT';
}

function matchKeyword(
  normalized: string,
  rules: SubscriptionKeywordRule[] = SUBSCRIPTION_KEYWORD_RULES
): { nome_amigavel: string; keyword: string; categoria: string } | null {
  for (const rule of rules) {
    const hit =
      typeof rule.match === 'string'
        ? normalized.includes(rule.match.toUpperCase())
        : rule.match.test(normalized);
    if (hit) {
      return {
        nome_amigavel: rule.nome_amigavel,
        keyword: typeof rule.match === 'string' ? rule.match : rule.match.source,
        categoria: rule.categoria || 'Streaming',
      };
    }
  }
  return null;
}

/** Chave de agrupamento para repetição (sem keyword). */
export function merchantGroupKey(normalized: string): string {
  const trimmed = normalized.replace(/\d{2,}/g, ' ').replace(/\s+/g, ' ').trim();
  const core = trimmed.slice(0, 28).trim();
  return core || trimmed.slice(0, 12) || 'DESCONHECIDO';
}

function stableId(groupKey: string): string {
  let h = 0;
  for (let i = 0; i < groupKey.length; i++) {
    h = (h * 31 + groupKey.charCodeAt(i)) >>> 0;
  }
  return `sub_${h.toString(16)}`;
}

function amountsSimilar(a: number, b: number, tolerance = 0.2): boolean {
  if (a <= 0 || b <= 0) return false;
  const max = Math.max(a, b);
  const min = Math.min(a, b);
  return (max - min) / max <= tolerance;
}

function modeDay(days: number[]): number | null {
  if (!days.length) return null;
  const freq = new Map<number, number>();
  for (const d of days) {
    freq.set(d, (freq.get(d) || 0) + 1);
  }
  let best: number | null = null;
  let bestN = 0;
  for (const [d, n] of freq) {
    if (n > bestN) {
      bestN = n;
      best = d;
    }
  }
  return best;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? roundMoney((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

function tituloJaCadastrado(
  nome: string,
  existing: string[] | undefined
): boolean {
  if (!existing?.length) return false;
  const n = normalizeSubscriptionDescription(nome);
  return existing.some((t) => {
    const e = normalizeSubscriptionDescription(t);
    if (!e || !n) return false;
    return e === n || e.includes(n) || n.includes(e);
  });
}

type GroupAcc = {
  groupKey: string;
  nome_amigavel: string;
  categoria: string;
  keyword: string | null;
  txs: Array<{
    id: string;
    desc: string;
    amount: number;
    date: string | null;
    month: string | null;
    day: number | null;
  }>;
};

/**
 * Identifica possíveis assinaturas e contas fixas a partir de transações Pluggy / Open Finance.
 */
export function detectSubscriptions(
  transactions: PluggyTransactionLike[],
  options: DetectSubscriptionsOptions = {}
): DetectedSubscription[] {
  const list = Array.isArray(transactions) ? transactions : [];
  const minMonths = options.minMonthsForRepetition ?? 2;
  const groups = new Map<string, GroupAcc>();

  for (const tx of list) {
    if (!isDebitExpense(tx)) continue;

    const desc = txDescription(tx);
    if (!desc) continue;

    const normalized = normalizeSubscriptionDescription(desc);
    if (!normalized || normalized.length < 3) continue;

    const kw = matchKeyword(normalized);
    const groupKey = kw ? `kw:${kw.keyword}` : `m:${merchantGroupKey(normalized)}`;
    const amount = absAmount(tx.amount);
    if (amount <= 0) continue;

    const date = toIsoDateOnly(tx.date);
    const existing = groups.get(groupKey);
    const entry = {
      id: txId(tx),
      desc,
      amount,
      date,
      month: monthKey(date),
      day: dayOfMonth(date),
    };

    if (existing) {
      existing.txs.push(entry);
    } else {
      groups.set(groupKey, {
        groupKey,
        nome_amigavel: kw?.nome_amigavel ?? merchantGroupKey(normalized),
        categoria: kw?.categoria ?? 'Servicos',
        keyword: kw?.keyword ?? null,
        txs: [entry],
      });
    }
  }

  const results: DetectedSubscription[] = [];

  for (const g of groups.values()) {
    const months = new Set(g.txs.map((t) => t.month).filter(Boolean) as string[]);
    const repeticoes_meses = months.size;

    const amounts = g.txs.map((t) => t.amount).filter((a) => a > 0);
    const sortedByDate = [...g.txs].sort((a, b) =>
      String(b.date || '').localeCompare(String(a.date || ''))
    );
    const last = sortedByDate[0];
    const valor = last?.amount ?? median(amounts);
    const valor_minimo = amounts.length ? Math.min(...amounts) : valor;
    const valor_maximo = amounts.length ? Math.max(...amounts) : valor;

    const days = g.txs.map((t) => t.day).filter((d): d is number => d != null);
    const dia_cobranca_esperado = modeDay(days);

    const hasKeyword = Boolean(g.keyword);
    const amountsStable =
      amounts.length >= 2 &&
      amounts.every((a, _, arr) => amountsSimilar(a, arr[0], 0.25));

    let confianca: DetectedSubscriptionConfidence = 'baixa';
    if (hasKeyword && repeticoes_meses >= 1) confianca = 'alta';
    else if (repeticoes_meses >= 3 && amountsStable) confianca = 'alta';
    else if (repeticoes_meses >= minMonths && amountsStable) confianca = 'media';
    else if (repeticoes_meses >= minMonths) confianca = 'media';

    const sugestao_assinatura =
      hasKeyword || repeticoes_meses >= minMonths || (repeticoes_meses >= 1 && hasKeyword);

    if (!sugestao_assinatura && confianca === 'baixa') continue;

    const displayName =
      hasKeyword || g.nome_amigavel.length < 4
        ? g.nome_amigavel
        : g.nome_amigavel.charAt(0) + g.nome_amigavel.slice(1).toLowerCase();

    results.push({
      id: stableId(g.groupKey),
      nome_amigavel: displayName,
      valor,
      dia_cobranca_esperado,
      sugestao_assinatura: true,
      confianca,
      categoria: g.categoria,
      keyword_match: g.keyword,
      repeticoes_meses,
      ultima_data: last?.date ?? null,
      descricao_original: last?.desc ?? g.txs[0]?.desc ?? '',
      valor_minimo,
      valor_maximo,
      pluggy_transaction_ids: g.txs.map((t) => t.id).filter(Boolean),
      ja_cadastrada: tituloJaCadastrado(displayName, options.existingCobrancaTitulos),
    });
  }

  return results.sort((a, b) => {
    const rank = { alta: 0, media: 1, baixa: 2 };
    const dr = rank[a.confianca] - rank[b.confianca];
    if (dr !== 0) return dr;
    return (b.valor || 0) - (a.valor || 0);
  });
}

/** Converte linha `bank_transactions` do Supabase para entrada da detecção. */
export function bankTransactionToPluggyLike(row: Record<string, unknown>): PluggyTransactionLike {
  return {
    id: row.id as string | undefined,
    pluggy_transaction_id: row.pluggy_transaction_id as string | undefined,
    description: row.description as string | undefined,
    amount: row.amount as number | undefined,
    date: row.date as string | undefined,
    type: row.type as string | undefined,
    category: row.category as string | undefined,
  };
}
