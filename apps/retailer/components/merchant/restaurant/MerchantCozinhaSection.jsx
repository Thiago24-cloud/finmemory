'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChefHat, CheckCircle2, Clock, Loader2, PackageCheck, XCircle } from 'lucide-react';
import { painelApi } from '../../../lib/merchant/painelApiPaths';
import { usePedidosLojaRealtime } from '../../../hooks/usePedidosLojaRealtime';
import { SkipPageHeader } from '../skip/SkipPageHeader';
import { SkipCard, SkipCardContent } from '../skip/SkipCard';
import { SkipBadge } from '../skip/SkipBadge';
import { SkipButton } from '../skip/SkipButton';

const STATUS = {
  pendente: { label: 'Pendente', card: 'border-amber-500/50 shadow-subtle', badge: 'bg-amber-500/20 text-amber-600 border-0' },
  preparando: { label: 'Preparando', card: 'border-blue-500/50 shadow-subtle', badge: 'bg-blue-500/20 text-blue-600 border-0' },
  pronto: { label: 'Pronto', card: 'border-primary/50 shadow-subtle', badge: 'bg-primary/20 text-primary border-0' },
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
      const res = await fetch(`${painelApi.pedidos}?scope=cozinha&limit=50`);
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
    <div className="animate-fade-in-up">
      <SkipPageHeader
        icon={ChefHat}
        title="Cozinha"
        description="Pedidos em tempo real — mesa, balcão e delivery."
      />

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <ChefHat className="w-8 h-8 animate-pulse text-primary" />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center text-muted-foreground py-16">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="m-0">Nenhum pedido no momento.</p>
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
              <SkipCard key={order.id} className={meta.card}>
                <SkipCardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-base font-bold">{mesaLabel}</span>
                    <SkipBadge className={meta.badge}>
                      {order.status === 'pendente' ? (
                        <>
                          <Clock className="w-3 h-3 mr-1 inline" /> Pendente
                        </>
                      ) : order.status === 'preparando' ? (
                        <>
                          <ChefHat className="w-3 h-3 mr-1 inline" /> Preparando
                        </>
                      ) : (
                        meta.label
                      )}
                    </SkipBadge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3 m-0 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatTime(order.criado_em || order.created_at)}
                  </p>
                  <ul className="space-y-1.5 list-none p-0 m-0 mb-4">
                    {(order.itens || order.items || []).map((item, i) => (
                      <li key={i} className="text-sm flex justify-between">
                        <span>
                          <b className="text-primary">{item.quantidade || item.quantity || 1}x</b>{' '}
                          {item.nome || item.name}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-2">
                    {order.status === 'pendente' ? (
                      <>
                        <SkipButton
                          disabled={busy}
                          onClick={() => void updateStatus(order.id, 'preparando')}
                          className="flex-1"
                          size="sm"
                        >
                          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChefHat className="h-3.5 w-3.5" />}
                          Preparar
                        </SkipButton>
                        <SkipButton
                          variant="outline"
                          size="icon"
                          disabled={busy}
                          onClick={() => void updateStatus(order.id, 'cancelado')}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </SkipButton>
                      </>
                    ) : null}
                    {order.status === 'preparando' ? (
                      <SkipButton
                        disabled={busy}
                        onClick={() => void updateStatus(order.id, 'pronto')}
                        className="w-full"
                        variant="outline"
                        size="sm"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Pronto
                      </SkipButton>
                    ) : null}
                    {order.status === 'pronto' ? (
                      <SkipButton
                        disabled={busy}
                        onClick={() => void updateStatus(order.id, 'concluido')}
                        className="w-full"
                        variant="outline"
                        size="sm"
                      >
                        <PackageCheck className="h-3.5 w-3.5" />
                        Entregue
                      </SkipButton>
                    ) : null}
                  </div>
                </SkipCardContent>
              </SkipCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
