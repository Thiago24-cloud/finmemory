'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, DollarSign, Loader2, Receipt, Utensils, XCircle } from 'lucide-react';
import { painelApi } from '../../../lib/merchant/painelApiPaths';
import { usePedidosLojaRealtime } from '../../../hooks/usePedidosLojaRealtime';

function formatBrl(v) {
  return `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;
}

export function MerchantCaixaSection({ lojaId }) {
  const [orders, setOrders] = useState([]);
  const [mesas, setMesas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMesa, setSelectedMesa] = useState(null);
  const [busy, setBusy] = useState(false);
  const [cancelId, setCancelId] = useState(null);

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

  useEffect(() => {
    void load();
  }, [load]);

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

  const pagarMesa = async () => {
    if (!selected?.orders?.length) return;
    setBusy(true);
    try {
      await fetch(painelApi.caixaPagar, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pedido_ids: selected.orders.map((o) => o.id),
          mesa_id: selected.mesa?.id || null,
        }),
      });
      setSelectedMesa(null);
      await load();
    } finally {
      setBusy(false);
    }
  };

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
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold m-0 text-white flex items-center gap-2">
          <Receipt className="h-5 w-5 text-[#39FF14]" />
          Caixa
        </h2>
        <p className="text-xs text-white/50 mt-2 m-0">Contas em aberto — pagamento na mesa.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[#39FF14]" />
        </div>
      ) : allTables.filter((t) => t.active).length === 0 ? (
        <div className="text-center py-16 text-white/50">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="m-0 text-sm">Nenhuma conta aberta.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {allTables.filter((t) => t.active).map((t) => (
            <button
              key={t.numero}
              type="button"
              onClick={() => setSelectedMesa(t.numero === -1 ? 'balcao' : t.numero)}
              className="rounded-2xl border border-[#39FF14]/30 bg-[#39FF14]/5 p-4 text-center hover:bg-[#39FF14]/10 transition-colors"
            >
              <Utensils className="h-6 w-6 mx-auto text-[#39FF14] mb-2" />
              <p className="font-bold text-white m-0">
                {t.numero === -1 ? 'Balcão' : `Mesa ${t.numero}`}
              </p>
              <p className="text-lg font-black text-[#39FF14] mt-2 m-0">{formatBrl(t.total)}</p>
            </button>
          ))}
        </div>
      )}

      {selected ? (
        <div className="fixed inset-0 z-40 flex flex-col justify-end sm:justify-center sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            aria-label="Fechar"
            onClick={() => !busy && setSelectedMesa(null)}
          />
          <div className="relative w-full max-w-md max-h-[85vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-white/10 bg-[#0f0f14] p-5">
            <h3 className="text-lg font-bold m-0 text-white mb-4">
              {selected.numero === -1 ? 'Balcão' : `Mesa ${selected.numero}`}
            </h3>
            <div className="space-y-3 mb-4">
              {selected.orders.map((order) => (
                <div key={order.id} className="rounded-xl border border-white/10 p-3">
                  <div className="flex justify-between mb-2">
                    <span className="text-xs text-white/50">{order.status}</span>
                    <span className="font-bold text-[#39FF14]">{formatBrl(order.total)}</span>
                  </div>
                  {(order.itens || []).map((item, i) => (
                    <p key={i} className="text-sm text-white/80 m-0">
                      {item.quantidade}× {item.nome}
                    </p>
                  ))}
                  <button
                    type="button"
                    onClick={() => setCancelId(order.id)}
                    className="mt-2 text-xs text-red-400 underline"
                  >
                    Cancelar / estornar
                  </button>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center mb-4 pt-3 border-t border-white/10">
              <span className="text-white/60">Total</span>
              <span className="text-2xl font-black text-[#39FF14]">{formatBrl(selected.total)}</span>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void pagarMesa()}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#39FF14] py-3.5 font-bold text-[#050508] disabled:opacity-50"
            >
              <DollarSign className="h-5 w-5" />
              Confirmar pagamento
            </button>
          </div>
        </div>
      ) : null}

      {cancelId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            onClick={() => !busy && setCancelId(null)}
          />
          <div className="relative rounded-2xl border border-white/10 bg-[#0f0f14] p-5 max-w-sm w-full">
            <p className="font-bold text-white m-0 mb-2">Cancelar ou estornar?</p>
            <p className="text-sm text-white/50 m-0 mb-4">O estoque dos itens será restaurado.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void cancelOrder(cancelId, 'cancel')}
                disabled={busy}
                className="flex-1 rounded-lg border border-red-500/40 py-2 text-sm text-red-400"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void cancelOrder(cancelId, 'refund')}
                disabled={busy}
                className="flex-1 rounded-lg border border-purple-500/40 py-2 text-sm text-purple-400"
              >
                Estornar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
