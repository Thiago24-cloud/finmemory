'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, CheckCircle2, Loader2, Utensils } from 'lucide-react';
import { painelApi } from '../../../lib/merchant/painelApiPaths';
import { usePedidosLojaRealtime } from '../../../hooks/usePedidosLojaRealtime';
import { SkipPageHeader } from '../skip/SkipPageHeader';
import { SkipCard, SkipCardContent } from '../skip/SkipCard';
import { SkipButton } from '../skip/SkipButton';

function formatBrl(v) {
  return `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;
}

export function MerchantGarcomSection({ lojaId }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${painelApi.pedidos}?scope=garcom&limit=50`);
      const json = await res.json().catch(() => ({}));
      if (res.ok) setOrders(json.orders || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  usePedidosLojaRealtime(lojaId, load);

  const byMesa = useMemo(() => {
    const map = new Map();
    for (const o of orders) {
      const key = o.mesa_numero != null ? o.mesa_numero : 'balcao';
      const list = map.get(key) || [];
      list.push(o);
      map.set(key, list);
    }
    return [...map.entries()].sort((a, b) => {
      if (a[0] === 'balcao') return 1;
      if (b[0] === 'balcao') return -1;
      return Number(a[0]) - Number(b[0]);
    });
  }, [orders]);

  const entregar = async (id) => {
    setActionId(id);
    try {
      await fetch(painelApi.pedido(id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'concluido' }),
      });
      await load();
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="animate-fade-in-up">
      <SkipPageHeader
        icon={Bell}
        title="Garçom"
        description="Pedidos prontos para entregar na mesa."
      />

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : byMesa.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="m-0 text-sm">Nenhum pedido pronto para entrega.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {byMesa.map(([mesaKey, mesaOrders]) => {
            const label = mesaKey === 'balcao' ? 'Balcão' : `Mesa ${mesaKey}`;
            return (
              <SkipCard key={String(mesaKey)} className="border-primary/40 bg-primary/5 shadow-subtle">
                <SkipCardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold flex items-center gap-1">
                      <Utensils className="h-4 w-4 text-primary" />
                      {label}
                    </span>
                    <span className="text-[10px] font-bold text-primary animate-pulse">Pronto!</span>
                  </div>
                  <ul className="space-y-3 list-none p-0 m-0">
                    {mesaOrders.map((order) => (
                      <li key={order.id} className="text-sm border-t border-border pt-3 first:border-0 first:pt-0">
                        <p className="text-muted-foreground m-0 mb-1">{formatBrl(order.total)}</p>
                        {(order.itens || []).map((item, i) => (
                          <p key={i} className="text-foreground m-0 text-xs">
                            {item.quantidade}× {item.nome}
                          </p>
                        ))}
                        <SkipButton
                          disabled={actionId === order.id}
                          onClick={() => void entregar(order.id)}
                          className="mt-2 w-full"
                          size="sm"
                        >
                          {actionId === order.id ? '…' : 'Entregar pedido'}
                        </SkipButton>
                      </li>
                    ))}
                  </ul>
                </SkipCardContent>
              </SkipCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
