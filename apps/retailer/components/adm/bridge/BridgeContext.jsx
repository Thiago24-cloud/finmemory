'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const BridgeContext = createContext(null);

export function BridgeProvider({ children }) {
  const [merchants, setMerchants] = useState([]);
  const [merchantQuery, setMerchantQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [loadingMerchants, setLoadingMerchants] = useState(true);

  const loadMerchants = useCallback(async (q = '') => {
    setLoadingMerchants(true);
    try {
      const params = q ? `?q=${encodeURIComponent(q)}` : '';
      const res = await fetch(`/api/parceiros/adm/bridge/merchants${params}`);
      const data = await res.json();
      if (res.ok) {
        setMerchants(data.merchants || []);
      }
    } finally {
      setLoadingMerchants(false);
    }
  }, []);

  useEffect(() => {
    loadMerchants('');
  }, [loadMerchants]);

  useEffect(() => {
    const t = setTimeout(() => loadMerchants(merchantQuery), 300);
    return () => clearTimeout(t);
  }, [merchantQuery, loadMerchants]);

  const selectedMerchant = useMemo(
    () => merchants.find((m) => m.user_id === selectedUserId) || null,
    [merchants, selectedUserId]
  );

  useEffect(() => {
    if (!selectedUserId && merchants.length > 0) {
      setSelectedUserId(merchants[0].user_id);
    }
  }, [merchants, selectedUserId]);

  const value = {
    merchants,
    merchantQuery,
    setMerchantQuery,
    selectedUserId,
    setSelectedUserId,
    selectedMerchant,
    loadingMerchants,
    reloadMerchants: loadMerchants,
  };

  return <BridgeContext.Provider value={value}>{children}</BridgeContext.Provider>;
}

export function useBridgeContext() {
  const ctx = useContext(BridgeContext);
  if (!ctx) throw new Error('useBridgeContext must be used within BridgeProvider');
  return ctx;
}

export function BridgeMerchantSelector({ className = '', compact = false, sidebar = false }) {
  const {
    merchants,
    merchantQuery,
    setMerchantQuery,
    selectedUserId,
    setSelectedUserId,
    loadingMerchants,
    selectedMerchant,
  } = useBridgeContext();

  if (sidebar) {
    return (
      <div className={`space-y-2 ${className}`}>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#9ca3af] px-1 fm-bridge-merchant-label">
          Comerciante
        </p>
        <select
          className="fm-bridge-merchant-select w-full px-2 py-1.5 text-xs"
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
          disabled={loadingMerchants || merchants.length === 0}
        >
          {merchants.length === 0 ? (
            <option value="">—</option>
          ) : (
            merchants.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.store_name || m.name || m.email}
              </option>
            ))
          )}
        </select>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 ${className}`}>
        <span className="text-xs text-[#6b7280] shrink-0">Loja:</span>
        <select
          className="fm-bridge-merchant-select flex-1 px-3 py-2 min-w-0"
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
          disabled={loadingMerchants || merchants.length === 0}
        >
          {merchants.length === 0 ? (
            <option value="">Nenhum comerciante</option>
          ) : (
            merchants.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.store_name || m.name} — {m.email}
              </option>
            ))
          )}
        </select>
        <input
          className="fm-bridge-merchant-select sm:max-w-[200px] px-3 py-2"
          placeholder="Buscar…"
          value={merchantQuery}
          onChange={(e) => setMerchantQuery(e.target.value)}
        />
        {selectedMerchant ? (
          <span className="text-[10px] text-[#9ca3af] hidden lg:inline truncate max-w-[180px]">
            {selectedMerchant.store_name}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-[#e8ece9] bg-white p-3 space-y-2 ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
        Comerciante (contexto Bridge)
      </p>
      <input
        className="fm-bridge-merchant-select w-full px-3 py-2"
        placeholder="Buscar por e-mail ou nome…"
        value={merchantQuery}
        onChange={(e) => setMerchantQuery(e.target.value)}
      />
      <select
        className="fm-bridge-merchant-select w-full px-3 py-2"
        value={selectedUserId}
        onChange={(e) => setSelectedUserId(e.target.value)}
        disabled={loadingMerchants || merchants.length === 0}
      >
        {merchants.length === 0 ? (
          <option value="">Nenhum comerciante com loja vinculada</option>
        ) : (
          merchants.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.store_name || m.name || m.email} — {m.email}
            </option>
          ))
        )}
      </select>
    </div>
  );
}
