'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChefHat, CheckCircle2, Clock, Loader2, PackageCheck, XCircle } from 'lucide-react';
import { painelApi } from '../../../lib/merchant/painelApiPaths';
import { usePedidosLojaRealtime } from '../../../hooks/usePedidosLojaRealtime';

const STATUS = {
  pendente: { label: 'Novo', color: 'border-amber-500/50 bg-amber-500/10' },
  preparando: { label: 'Preparando', color: 'border-blue-500/50 bg-blue-500/10' },
  pronto: { label: 'Pronto', color: 'border-[#39FF14]/50 bg-[#39FF14]/10' },
};

function formatTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

export function MerchantCozinhaSection({ lojaId }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${painelApi.pedidos}?limit=50`);
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        const active = (json.orders || []).filter((o) =>
          ['pendente', 'preparando', 'pronto'].includes(o.status)
        );
        setOrders(active);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  usePedidosLojaRealtime(lojaId, load);

  const updateStatus = async (id, status) => {
    setActionId(id);
    try {
      await fetch(painelApi.pedido(id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      await load();
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold m-0 text-white flex items-center gap-2">
          <ChefHat className="h-5 w-5 text-[#39FF14]" />
          Cozinha
        </h2>
        <p className="text-xs text-white/50 mt-2 m-0">
          Pedidos em tempo real — mesa, balcão e delivery.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-white/60 py-8 justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[#39FF14]" />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-white/50">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="m-0 text-sm">Nenhum pedido na cozinha.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders.map((order) => {
            const meta = STATUS[order.status] || STATUS.pendente;
            const busy = actionId === order.id;
            const mesaLabel =
              order.mesa_numero != null
                ? `Mesa ${order.mesa_numero}`
                : order.origem === 'delivery'
                  ? 'Delivery'
                  : 'Balcão';
            return (
              <article
                key={order.id}
                className={`rounded-2xl border p-4 ${meta.color}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-white">{mesaLabel}</span>
                  <span className="text-xs text-white/50 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatTime(order.criado_em || order.created_at)}
                  </span>
                </div>
                <p className="text-xs font-semibold text-white/70 mb-3 m-0">{meta.label}</p>
                <ul className="space-y-1 list-none p-0 m-0 mb-4">
                  {(order.itens || order.items || []).map((item, i) => (
                    <li key={i} className="text-sm text-white/90 flex justify-between gap-2">
                      <span className="truncate">
                        {item.quantidade > 1 ? `${item.quantidade}× ` : ''}
                        {item.nome || item.name}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2">
                  {order.status === 'pendente' ? (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void updateStatus(order.id, 'preparando')}
                        className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-[#39FF14] py-2 text-xs font-bold text-[#050508]"
                      >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChefHat className="h-3.5 w-3.5" />}
                        Preparar
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void updateStatus(order.id, 'cancelado')}
                        className="rounded-lg border border-white/20 px-3 py-2 text-xs text-white/60"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : null}
                  {order.status === 'preparando' ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void updateStatus(order.id, 'pronto')}
                      className="w-full inline-flex items-center justify-center gap-1 rounded-lg border border-[#39FF14]/50 bg-[#39FF14]/10 py-2 text-xs font-semibold text-[#39FF14]"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Pronto
                    </button>
                  ) : null}
                  {order.status === 'pronto' ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void updateStatus(order.id, 'concluido')}
                      className="w-full inline-flex items-center justify-center gap-1 rounded-lg border border-white/25 py-2 text-xs text-white/80"
                    >
                      <PackageCheck className="h-3.5 w-3.5" />
                      Entregue
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
