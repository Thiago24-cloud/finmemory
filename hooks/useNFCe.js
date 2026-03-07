import { useState, useCallback } from 'react';

const STATUS = {
  IDLE: 'idle',
  CONSULTING: 'consulting',
  CATEGORIZING: 'categorizing',
  SAVING: 'saving',
  SUCCESS: 'success',
  ERROR: 'error'
};

/**
 * Hook para fluxo NFC-e: consultar → categorizar → salvar.
 * consultar(url) inicia o fluxo; salvar usa userId (ex.: session.user.supabaseId).
 */
export function useNFCe() {
  const [status, setStatus] = useState(STATUS.IDLE);
  const [nfceData, setNfceData] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const reset = useCallback(() => {
    setStatus(STATUS.IDLE);
    setNfceData(null);
    setError(null);
    setNotice(null);
  }, []);

  const consultar = useCallback(async (url, userId) => {
    if (!url || !url.trim()) {
      setError('URL ou conteúdo do QR é obrigatório');
      setStatus(STATUS.ERROR);
      return null;
    }
    setError(null);
    setNotice(null);
    setStatus(STATUS.CONSULTING);

    try {
      const res = await fetch('/api/consultar-nfce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() })
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Não foi possível consultar a NFC-e');
        setNotice(null);
        setStatus(STATUS.ERROR);
        return null;
      }

      if (data.aviso) {
        setNotice(data.aviso);
      }

      const payload = {
        estabelecimento: data.estabelecimento,
        endereco: data.endereco,
        data: data.data,
        cnpj: data.cnpj,
        total: data.total,
        itens: data.itens || [],
        nfce_url: data.nfce_url || url
      };
      setNfceData(payload);

      if (!userId) {
        setStatus(STATUS.SUCCESS);
        return payload;
      }

      setStatus(STATUS.CATEGORIZING);
      const catRes = await fetch('/api/categorizar-nfce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estabelecimento: payload.estabelecimento,
          itens: payload.itens,
          total: payload.total
        })
      });
      const catJson = await catRes.json();
      const category = catJson.category || 'Outros';

      setStatus(STATUS.SAVING);
      const saveRes = await fetch('/api/salvar-nfce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          estabelecimento: payload.estabelecimento,
          endereco: payload.endereco,
          cnpj: payload.cnpj,
          data: payload.data,
          total: payload.total,
          itens: payload.itens,
          category,
          forma_pagamento: null,
          nfce_url: payload.nfce_url
        })
      });
      const saveJson = await saveRes.json();

      if (!saveRes.ok) {
        setError(saveJson.error || 'Erro ao salvar nota');
        setStatus(STATUS.ERROR);
        return null;
      }

      setStatus(STATUS.SUCCESS);
      return { ...payload, category, transaction: saveJson.transaction };
    } catch (err) {
      console.error('useNFCe error:', err);
      setError(err.message || 'Erro ao processar NFC-e');
      setNotice(null);
      setStatus(STATUS.ERROR);
      return null;
    }
  }, []);

  return {
    status,
    nfceData,
    error,
    notice,
    consultar,
    reset,
    isIdle: status === STATUS.IDLE,
    isConsulting: status === STATUS.CONSULTING,
    isCategorizing: status === STATUS.CATEGORIZING,
    isSaving: status === STATUS.SAVING,
    isSuccess: status === STATUS.SUCCESS,
    isError: status === STATUS.ERROR
  };
}
