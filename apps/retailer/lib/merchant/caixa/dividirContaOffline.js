/**
 * Dividir conta — estado local (offline-first) + fila de sync para o servidor.
 * Matemáticas e histórico vivem no celular; sync quando a internet voltar.
 */

const DRAFT_KEY = 'finmemory_caixa_dividir_v1';
const SYNC_KEY = 'finmemory_caixa_sync_queue_v1';

function safeParse(raw, fallback) {
  try {
    const v = JSON.parse(raw);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

export function mesaDraftKey({ lojaId, mesaId, pedidoIds }) {
  const ids = [...(pedidoIds || [])].map(String).sort().join(',');
  return `${lojaId || 'loja'}|${mesaId || 'balcao'}|${ids}`;
}

export function loadDividirDraft(key) {
  if (typeof window === 'undefined' || !key) return null;
  const all = safeParse(window.localStorage.getItem(DRAFT_KEY), {});
  const draft = all[key];
  if (!draft || !Array.isArray(draft.pagamentos)) return null;
  return draft;
}

export function saveDividirDraft(key, draft) {
  if (typeof window === 'undefined' || !key) return;
  const all = safeParse(window.localStorage.getItem(DRAFT_KEY), {});
  all[key] = {
    ...draft,
    updatedAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(all));
  } catch {
    /* quota */
  }
}

export function clearDividirDraft(key) {
  if (typeof window === 'undefined' || !key) return;
  const all = safeParse(window.localStorage.getItem(DRAFT_KEY), {});
  delete all[key];
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

export function enqueueCaixaSync(payload) {
  if (typeof window === 'undefined') return;
  const q = safeParse(window.localStorage.getItem(SYNC_KEY), []);
  q.push({
    ...payload,
    queuedAt: new Date().toISOString(),
    id: `sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  });
  try {
    window.localStorage.setItem(SYNC_KEY, JSON.stringify(q));
  } catch {
    /* ignore */
  }
}

export function peekCaixaSyncQueue() {
  if (typeof window === 'undefined') return [];
  return safeParse(window.localStorage.getItem(SYNC_KEY), []);
}

export function removeCaixaSyncItem(id) {
  if (typeof window === 'undefined') return;
  const q = safeParse(window.localStorage.getItem(SYNC_KEY), []).filter((x) => x.id !== id);
  try {
    window.localStorage.setItem(SYNC_KEY, JSON.stringify(q));
  } catch {
    /* ignore */
  }
}

export function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

export function sumPagamentos(pagamentos) {
  return roundMoney(
    (pagamentos || []).reduce((s, p) => s + Number(p.valor || 0), 0)
  );
}

export function remainingOf(total, pagamentos) {
  return roundMoney(Math.max(0, Number(total || 0) - sumPagamentos(pagamentos)));
}

export function dominantFormaPagamento(pagamentos) {
  const list = pagamentos || [];
  if (!list.length) return null;
  const forms = new Set(list.map((p) => p.forma));
  if (forms.size === 1) return list[0].forma;
  return 'misto';
}

/**
 * Converte digitação estilo maquininha ("40" ou "40,50" ou centavos "4050") em reais.
 */
export function parseMoneyInput(raw) {
  const s = String(raw || '')
    .trim()
    .replace(/\s/g, '')
    .replace('R$', '')
    .replace(/\./g, '')
    .replace(',', '.');
  if (!s) return 0;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return 0;
  return roundMoney(n);
}

export function formatBrl(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export const FORMA_LABEL = {
  debito: 'Débito',
  credito: 'Crédito',
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  misto: 'Misto',
};
