'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChefHat,
  Clock,
  Loader2,
  MessageCircle,
  PackageCheck,
  Truck,
  XCircle,
} from 'lucide-react';
import { painelApi } from '../../../lib/merchant/painelApiPaths';
import { usePedidosLojaRealtime } from '../../../hooks/usePedidosLojaRealtime';
import { SkipPageHeader } from '../skip/SkipPageHeader';
import { SkipCard, SkipCardContent } from '../skip/SkipCard';
import { SkipBadge } from '../skip/SkipBadge';
import { SkipButton } from '../skip/SkipButton';

function formatTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function formatBrl(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function waUrl(phone, text) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  const full = digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${full}?text=${encodeURIComponent(text || '')}`;
}

const STATUS_META = {
  pendente: { label: 'Pendente', badge: 'bg-amber-500/20 text-amber-700 border-0' },
  pending: { label: 'Pendente', badge: 'bg-amber-500/20 text-amber-700 border-0' },
  accepted: { label: 'Aceito', badge: 'bg-sky-500/20 text-sky-700 border-0' },
  preparando: { label: 'Preparando', badge: 'bg-blue-500/20 text-blue-700 border-0' },
  preparing: { label: 'Preparando', badge: 'bg-blue-500/20 text-blue-700 border-0' },
  pronto: { label: 'Pronto', badge: 'bg-primary/20 text-primary border-0' },
  ready_for_pickup: { label: 'Pronto p/ retirada', badge: 'bg-primary/20 text-primary border-0' },
  out_for_delivery: { label: 'Saiu p/ entrega', badge: 'bg-violet-500/20 text-violet-700 border-0' },
  concluido: { label: 'Entregue', badge: 'bg-emerald-500/20 text-emerald-700 border-0' },
  delivered: { label: 'Entregue', badge: 'bg-emerald-500/20 text-emerald-700 border-0' },
  cancelado: { label: 'Cancelado', badge: 'bg-destructive/20 text-destructive border-0' },
  canceled: { label: 'Cancelado', badge: 'bg-destructive/20 text-destructive border-0' },
};

function nextActions(order) {
  const s = order.status_en || order.status;
  const isDelivery = order.order_type === 'delivery' || order.origem === 'delivery';
  if (s === 'pending' || s === 'pendente') {
    return [
      { status: 'accepted', label: 'Aceitar' },
      { status: 'canceled', label: 'Cancelar', outline: true, icon: 'cancel' },
    ];
  }
  if (s === 'accepted') {
    return [{ status: 'preparing', label: 'Preparar' }];
  }
  if (s === 'preparing' || s === 'preparando') {
    if (isDelivery) {
      return [{ status: 'out_for_delivery', label: 'Saiu p/ entrega' }];
    }
    return [{ status: 'ready_for_pickup', label: 'Pronto p/ retirada' }];
  }
  if (s === 'ready_for_pickup' || s === 'pronto' || s === 'out_for_delivery') {
    return [{ status: 'delivered', label: 'Concluir' }];
  }
  return [];
}

/**
 * Pedidos diretos (QR / página pública) + ações de status + WhatsApp.
 */
export function MerchantPedidosDiretosSection({ lojaId }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [filter, setFilter] = useState('ativos');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${painelApi.pedidos}?scope=diretos&limit=80`);
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

  const visible = orders.filter((o) => {
    const s = o.status_en || o.status;
    const done = ['delivered', 'concluido', 'canceled', 'cancelado'].includes(s);
    if (filter === 'ativos') return !done;
    if (filter === 'finalizados') return done;
    return true;
  });

  return (
    <div className="animate-fade-in-up">
      <SkipPageHeader
        icon={PackageCheck}
        title="Pedidos diretos"
        description="Pedidos da página pública / QR. Confirme e avise o cliente no WhatsApp."
      />

      <div className="flex gap-2 mb-4">
        {[
          { id: 'ativos', label: 'Ativos' },
          { id: 'finalizados', label: 'Finalizados' },
          { id: 'todos', label: 'Todos' },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold border ${
              filter === f.id
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12 m-0">
          Nenhum pedido direto no momento.
        </p>
      ) : (
        <div className="space-y-3">
          {visible.map((order) => {
            const meta = STATUS_META[order.status] || STATUS_META[order.status_en] || STATUS_META.pending;
            const busy = actionId === order.id;
            const actions = nextActions(order);
            const msg = `Olá ${order.customer_name || ''}! Seu pedido ${order.pickup_code || ''} na loja está: ${order.status_label || meta.label}.`;
            const link = waUrl(order.customer_phone, msg);
            return (
              <SkipCard key={order.id} className="shadow-subtle">
                <SkipCardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold m-0">
                        {order.pickup_code || '—'} · {order.customer_name || 'Cliente'}
                      </p>
                      <p className="text-xs text-muted-foreground m-0 mt-0.5">
                        {order.order_type === 'delivery' ? 'Entrega' : 'Retirada'} ·{' '}
                        {formatTime(order.criado_em)} · {formatBrl(order.total_amount ?? order.total)}
                      </p>
                    </div>
                    <SkipBadge className={meta.badge}>{order.status_label || meta.label}</SkipBadge>
                  </div>
                  <ul className="text-sm space-y-1 list-none p-0 m-0">
                    {(order.itens || []).map((item) => (
                      <li key={item.id || item.nome}>
                        <b className="text-primary">{item.quantidade}x</b> {item.nome}
                      </li>
                    ))}
                  </ul>
                  {order.notes || order.observacao ? (
                    <p className="text-xs text-muted-foreground m-0">Obs: {order.notes || order.observacao}</p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {actions.map((a) => (
                      <SkipButton
                        key={a.status}
                        size="sm"
                        variant={a.outline ? 'outline' : 'default'}
                        disabled={busy}
                        onClick={() => void updateStatus(order.id, a.status)}
                      >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        {a.icon === 'cancel' ? <XCircle className="h-3.5 w-3.5" /> : null}
                        {a.status === 'preparing' ? <ChefHat className="h-3.5 w-3.5" /> : null}
                        {a.status === 'out_for_delivery' ? <Truck className="h-3.5 w-3.5" /> : null}
                        {a.status === 'delivered' ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                        {a.status === 'ready_for_pickup' ? <PackageCheck className="h-3.5 w-3.5" /> : null}
                        {a.status === 'accepted' ? <Clock className="h-3.5 w-3.5" /> : null}
                        {a.label}
                      </SkipButton>
                    ))}
                    {link ? (
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-bold text-[#128C7E]"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        WhatsApp
                      </a>
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
