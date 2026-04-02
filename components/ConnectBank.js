'use client';

import { useState, useCallback } from 'react';
import { PluggyConnect } from 'react-pluggy-connect';

/**
 * Abre o widget Pluggy Connect: obtém connect token no servidor e associa o item após sucesso.
 *
 * @param {(itemId: string) => void} [props.onSuccess]
 * @param {(error: Error) => void} [props.onError]
 */
export default function ConnectBank({ onSuccess, onError }) {
  const [connectToken, setConnectToken] = useState(null);
  const [widgetSandbox, setWidgetSandbox] = useState({
    connectorId: null,
    restrictConnector: false,
  });
  const [loading, setLoading] = useState(false);

  const openWidget = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pluggy/connect-token', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Erro ${res.status}`);
      }
      if (!data.accessToken) {
        throw new Error('Resposta sem accessToken');
      }
      setConnectToken(data.accessToken);
      const rawId = data.sandboxConnectorId;
      const n =
        typeof rawId === 'number' ? rawId : typeof rawId === 'string' ? Number(rawId) : NaN;
      const connectorId = Number.isFinite(n) && n > 0 ? n : null;
      setWidgetSandbox({
        connectorId,
        restrictConnector: Boolean(data.useSandboxConnectorOnly && connectorId),
      });
    } catch (e) {
      onError?.(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [onError]);

  const handleSuccess = useCallback(
    async ({ item }) => {
      const itemId = item?.id;
      if (!itemId) {
        onError?.(new Error('Item sem id na resposta do Pluggy'));
        setConnectToken(null);
        setWidgetSandbox({ connectorId: null, restrictConnector: false });
        return;
      }
      try {
        const res = await fetch('/api/pluggy/callback', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || `Erro ao guardar conexão (${res.status})`);
        }
        onSuccess?.(itemId);
      } catch (e) {
        onError?.(e instanceof Error ? e : new Error(String(e)));
      } finally {
        setConnectToken(null);
        setWidgetSandbox({ connectorId: null, restrictConnector: false });
      }
    },
    [onSuccess, onError]
  );

  const handlePluggyError = useCallback(
    (pluggyError) => {
      const msg = pluggyError?.message || 'Erro no Pluggy Connect';
      onError?.(new Error(msg));
      setConnectToken(null);
      setWidgetSandbox({ connectorId: null, restrictConnector: false });
    },
    [onError]
  );

  const handleClose = useCallback(() => {
    setConnectToken(null);
    setWidgetSandbox({ connectorId: null, restrictConnector: false });
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={openWidget}
        disabled={loading || !!connectToken}
        className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {loading ? 'A abrir…' : 'Conectar meu banco'}
      </button>

      {connectToken ? (
        <PluggyConnect
          connectToken={connectToken}
          includeSandbox
          connectorIds={
            widgetSandbox.restrictConnector && widgetSandbox.connectorId != null
              ? [widgetSandbox.connectorId]
              : undefined
          }
          selectedConnectorId={
            widgetSandbox.restrictConnector && widgetSandbox.connectorId != null
              ? widgetSandbox.connectorId
              : undefined
          }
          onSuccess={handleSuccess}
          onError={handlePluggyError}
          onClose={handleClose}
        />
      ) : null}
    </div>
  );
}
