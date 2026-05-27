import { useCallback, useEffect, useState } from 'react';

async function fetchSummary(accountId) {
  const q = accountId ? `?accountId=${encodeURIComponent(accountId)}` : '';
  const res = await fetch(`/api/open-finance/summary${q}`, { credentials: 'include' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

/**
 * Resumo Open Finance: contas, transações recentes, totais do mês, flag syncing.
 * @param {{ enabled?: boolean; accountId?: string | null }} [options] — accountId filtra transações e totais do mês.
 */
export function useOpenFinanceSummary(options = {}) {
  const enabled = options.enabled !== false;
  const accountId = options.accountId != null && options.accountId !== '' ? options.accountId : null;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const json = await fetchSummary(accountId);
      setData(json);
    } catch (e) {
      setError(e);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [enabled, accountId]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setData(null);
      setError(null);
      return undefined;
    }
    refresh();
    return undefined;
  }, [enabled, refresh]);

  return { data, loading, error, refresh };
}

/**
 * Lista de contas (derivado do mesmo endpoint de resumo).
 * @param {{ enabled?: boolean }} [options]
 */
export function useBankAccounts(options = {}) {
  const { data, loading, error, refresh } = useOpenFinanceSummary(options);
  return {
    accounts: data?.accounts ?? [],
    syncing: data?.syncing ?? false,
    loading,
    error,
    refresh,
  };
}

/**
 * Transações recentes; opcionalmente filtradas por conta interna (uuid bank_accounts.id).
 * @param {string | null | undefined} accountId
 * @param {{ enabled?: boolean }} [options]
 */
export function useBankTransactions(accountId, options = {}) {
  const enabled = options.enabled !== false;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const json = await fetchSummary(accountId || undefined);
      setData(json);
    } catch (e) {
      setError(e);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [accountId, enabled]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setData(null);
      setError(null);
      return undefined;
    }
    refresh();
    return undefined;
  }, [enabled, refresh]);

  return {
    transactions: data?.recentTransactions ?? [],
    syncing: data?.syncing ?? false,
    month: data?.month,
    accounts: data?.accounts ?? [],
    loading,
    error,
    refresh,
  };
}
