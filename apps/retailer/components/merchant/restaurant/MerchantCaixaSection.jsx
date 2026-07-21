'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Loader2,
  Receipt,
  Split,
  Utensils,
  WifiOff,
} from 'lucide-react';
import { painelApi } from '../../../lib/merchant/painelApiPaths';
import { usePedidosLojaRealtime } from '../../../hooks/usePedidosLojaRealtime';
import {
  peekCaixaSyncQueue,
  removeCaixaSyncItem,
} from '../../../lib/merchant/caixa/dividirContaOffline';
import { SkipPageHeader } from '../skip/SkipPageHeader';
import { SkipCard, SkipCardContent } from '../skip/SkipCard';
import { SkipButton } from '../skip/SkipButton';
import { DividirContaMesa } from './DividirContaMesa';

function formatBrl(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function MerchantCaixaSection({ lojaId }) {
  const [orders, setOrders] = useState([]);
  const [mesas, setMesas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMesa, setSelectedMesa] = useState(null);
  const [dividirOpen, setDividirOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cancelId, setCancelId] = useState(null);
  const [pendingSync, setPendingSync] = useState(0);
  const [syncMsg, setSyncMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ordRes, mesaRes] = await Promise.all([
        fetch(`${painelApi.pedidos}?scope=caixa&limit=100`),
        fetch(painelApi.mesas),
      ]);
      const ordJson = await ordRes.json().catch(() => ({}));
      const mesaJson = await mesaRes.json().catch(() => ({}));
      if (ordRes.ok) setOrders(ordJson.orders || []);
      if (mesaRes.ok) setMesas(mesaJson.mesas || []);
    } finally {
      setLoading(false);
    }
  }, []);

  const flushSyncQueue = useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setPendingSync(peekCaixaSyncQueue().length);
      return;
    }
    const q = peekCaixaSyncQueue();
    setPendingSync(q.length);
    if (!q.length) return;

    let ok = 0;
    for (const item of q) {
      try {
        const res = await fetch(painelApi.caixaPagar, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pedido_ids: item.pedido_ids,
            mesa_id: item.mesa_id || null,
            forma_pagamento: item.forma_pagamento,
            pagamentos: item.pagamentos,
          }),
        });
        if (res.ok || res.status === 400) {
          // 400 = já pago / inválido — remove da fila para não travar
          removeCaixaSyncItem(item.id);
          if (res.ok) ok += 1;
        }
      } catch {
        break;
      }
    }
    const left = peekCaixaSyncQueue().length;
    setPendingSync(left);
    if (ok > 0) {
      setSyncMsg(`${ok} mesa(s) sincronizada(s) após ficar offline.`);
      await load();
    }
  }, [load]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void flushSyncQueue();
    const onOnline = () => void flushSyncQueue();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [flushSyncQueue]);

  usePedidosLojaRealtime(lojaId, load);

  const tableData = useMemo(() => {
    const mesaNums = new Set(mesas.map((m) => m.numero));
    for (const o of orders) {
      if (o.mesa_numero != null) mesaNums.add(o.mesa_numero);
    }
    return [...mesaNums]
      .sort((a, b) => a - b)
      .map((numero) => {
        const mesaOrders = orders.filter((o) => o.mesa_numero === numero);
        const total = mesaOrders.reduce((s, o) => s + Number(o.total || 0), 0);
        const mesa = mesas.find((m) => m.numero === numero);
        return { numero, mesa, orders: mesaOrders, total, active: mesaOrders.length > 0 };
      });
  }, [mesas, orders]);

  const balcaoOrders = orders.filter((o) => o.mesa_numero == null);
  const allTables = useMemo(() => {
    const rows = [...tableData];
    if (balcaoOrders.length) {
      rows.unshift({
        numero: -1,
        mesa: null,
        orders: balcaoOrders,
        total: balcaoOrders.reduce((s, o) => s + Number(o.total || 0), 0),
        active: true,
      });
    }
    return rows;
  }, [tableData, balcaoOrders]);

  const selected = allTables.find((t) =>
    selectedMesa === 'balcao' ? t.numero === -1 : t.numero === selectedMesa
  );

  const cancelOrder = async (id, mode) => {
    setBusy(true);
    try {
      await fetch(painelApi.pedido(id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: mode }),
      });
      setCancelId(null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="animate-fade-in-up">
      <SkipPageHeader
        icon={Receipt}
        title="Caixa"
        description="Divida a conta sem calculadora — funciona offline."
      />

      {pendingSync > 0 ? (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          <WifiOff className="h-4 w-4 shrink-0" />
          {pendingSync} fechamento(s) aguardando internet para sincronizar.
        </div>
      ) : null}
      {syncMsg ? (
        <p className="mb-3 text-xs text-emerald-700 dark:text-emerald-300 m-0">{syncMsg}</p>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : allTables.filter((t) => t.active).length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="m-0 text-sm">Nenhuma conta aberta.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {allTables.filter((t) => t.active).map((t) => (
            <button
              key={t.numero}
              type="button"
              onClick={() => setSelectedMesa(t.numero === -1 ? 'balcao' : t.numero)}
              className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-center hover:bg-primary/10 transition-colors shadow-subtle"
            >
              <Utensils className="h-6 w-6 mx-auto text-primary mb-2" />
              <p className="font-bold m-0">{t.numero === -1 ? 'Balcão' : `Mesa ${t.numero}`}</p>
              <p className="text-lg font-black text-primary mt-2 m-0">{formatBrl(t.total)}</p>
            </button>
          ))}
        </div>
      )}

      {selected && !dividirOpen ? (
        <div className="fixed inset-0 z-40 flex flex-col justify-end sm:justify-center sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Fechar"
            onClick={() => !busy && setSelectedMesa(null)}
          />
          <SkipCard className="relative w-full max-w-md max-h-[85vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl shadow-lg z-10">
            <SkipCardContent className="p-5">
              <h3 className="text-lg font-bold m-0 mb-4">
                {selected.numero === -1 ? 'Balcão' : `Mesa ${selected.numero}`}
              </h3>
              <div className="space-y-3 mb-4">
                {selected.orders.map((order) => (
                  <div key={order.id} className="rounded-xl border border-border p-3">
                    <div className="flex justify-between mb-2">
                      <span className="text-xs text-muted-foreground">{order.status}</span>
                      <span className="font-bold text-primary">{formatBrl(order.total)}</span>
                    </div>
                    {(order.itens || []).map((item, i) => (
                      <p key={i} className="text-sm m-0">
                        {item.quantidade}× {item.nome}
                      </p>
                    ))}
                    <button
                      type="button"
                      onClick={() => setCancelId(order.id)}
                      className="mt-2 text-xs text-destructive underline bg-transparent border-0 cursor-pointer p-0"
                    >
                      Cancelar / estornar
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center mb-2 pt-3 border-t border-border">
                <span className="text-muted-foreground">Total</span>
                <span className="text-2xl font-black text-primary">{formatBrl(selected.total)}</span>
              </div>
              <p className="text-xs text-muted-foreground m-0 mb-4">
                Cobre na maquininha e registre cada pagamento no app — a conta não some se a internet cair.
              </p>
              <SkipButton
                disabled={busy}
                onClick={() => setDividirOpen(true)}
                className="w-full h-12 rounded-xl text-base font-bold"
              >
                <Split className="h-5 w-5" />
                Dividir conta
              </SkipButton>
            </SkipCardContent>
          </SkipCard>
        </div>
      ) : null}

      {dividirOpen && selected ? (
        <DividirContaMesa
          lojaId={lojaId}
          title={selected.numero === -1 ? 'Balcão' : `Mesa ${selected.numero}`}
          total={selected.total}
          pedidoIds={selected.orders.map((o) => o.id)}
          mesaId={selected.mesa?.id || null}
          onClose={() => setDividirOpen(false)}
          onClosed={async () => {
            setDividirOpen(false);
            setSelectedMesa(null);
            setPendingSync(peekCaixaSyncQueue().length);
            await load();
            void flushSyncQueue();
          }}
        />
      ) : null}

      {cancelId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => !busy && setCancelId(null)}
          />
          <SkipCard className="relative max-w-sm w-full z-10">
            <SkipCardContent className="p-5">
              <p className="font-bold m-0 mb-2">Cancelar ou estornar?</p>
              <p className="text-sm text-muted-foreground m-0 mb-4">O estoque dos itens será restaurado.</p>
              <div className="flex gap-2">
                <SkipButton
                  variant="outline"
                  onClick={() => void cancelOrder(cancelId, 'cancel')}
                  disabled={busy}
                  className="flex-1 text-destructive border-destructive/40"
                >
                  Cancelar
                </SkipButton>
                <SkipButton
                  variant="outline"
                  onClick={() => void cancelOrder(cancelId, 'refund')}
                  disabled={busy}
                  className="flex-1"
                >
                  Estornar
                </SkipButton>
              </div>
            </SkipCardContent>
          </SkipCard>
        </div>
      ) : null}
    </div>
  );
}
