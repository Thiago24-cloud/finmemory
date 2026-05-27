'use client';

import { useCallback, useEffect, useState } from 'react';
import { Clock, Loader2, ChefHat, CheckCircle2, PackageCheck, XCircle } from 'lucide-react';
import { painelApi } from '../../lib/merchant/painelApiPaths';
import { formatMerchantApiError, logMerchantApiFailure } from '../../lib/merchant/merchantApiErrorMessage';
import { usePedidosLojaRealtime } from '../../hooks/usePedidosLojaRealtime';

const STATUS_LABEL = {
  pendente: { label: 'Novo', className: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  preparando: { label: 'Preparando', className: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
  pronto: { label: 'Pronto p/ retirada', className: 'bg-[#39FF14]/20 text-[#39FF14] border-[#39FF14]/40' },
  concluido: { label: 'Concluído', className: 'bg-white/10 text-white/50 border-white/20' },
  cancelado: { label: 'Cancelado', className: 'bg-red-500/15 text-red-300 border-red-500/30' },
};

function formatTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function formatBrl(n) {
  return Number(n).toFixed(2).replace('.', ',');
}

function OrderActions({ order, onAction, busy }) {
  const { status, id } = order;
  if (status === 'pendente') {
    return (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => onAction(id, 'preparando')}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#39FF14] px-3 py-2 text-xs font-bold text-[#050508] hover:brightness-110 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChefHat className="h-3.5 w-3.5" />}
          Começar preparo
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onAction(id, 'cancelado')}
          className="inline-flex items-center gap-1 rounded-lg border border-white/20 px-3 py-2 text-xs text-white/60 hover:bg-white/5 disabled:opacity-50"
        >
          <XCircle className="h-3.5 w-3.5" />
          Cancelar
        </button>
      </div>
    );
  }
  if (status === 'preparando') {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => onAction(id, 'pronto')}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#39FF14]/50 bg-[#39FF14]/10 px-3 py-2 text-xs font-semibold text-[#39FF14] hover:bg-[#39FF14]/20 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
        Marcar pronto
      </button>
    );
  }
  if (status === 'pronto') {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => onAction(id, 'concluido')}
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/5 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PackageCheck className="h-3.5 w-3.5" />}
        Cliente retirou
      </button>
    );
  }
  return null;
}

export function MerchantOrdersSection({ lojaId, tempoPreparoMedio = 15 }) {
  const [orders, setOrders] = useState([]);
  const [activeCount, setActiveCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(painelApi.pedidos);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        logMerchantApiFailure('pedidos', res, data);
        if (res.status === 503) {
          setError(
            data.error ||
              'Tabela pedidos_loja ausente. Rode a migração 20260523120000 no Supabase.'
          );
        } else {
          setError(formatMerchantApiError(res, data, 'Erro ao carregar pedidos.'));
        }
        setOrders([]);
        return;
      }
      setOrders(data.orders || []);
      setActiveCount(data.active_count ?? 0);
    } catch {
      setError('Erro de rede ao carregar pedidos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 90000);
    return () => clearInterval(t);
  }, [load]);

  usePedidosLojaRealtime(lojaId, load);

  const onAction = async (pedidoId, status) => {
    setActionId(pedidoId);
    try {
      const res = await fetch(painelApi.pedido(pedidoId), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'Não foi possível atualizar o pedido.');
        return;
      }
      await load();
    } catch {
      alert('Erro de rede.');
    } finally {
      setActionId(null);
    }
  };

  const activeOrders = orders.filter((o) => ['pendente', 'preparando', 'pronto'].includes(o.status));
  const historyOrders = orders.filter((o) => ['concluido', 'cancelado'].includes(o.status)).slice(0, 10);

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold m-0 flex items-center gap-2">
            <Clock className="h-5 w-5 text-[#39FF14]" aria-hidden />
            Pedidos para retirada
          </h2>
          <p className="text-xs text-white/45 mt-1 m-0">
            ETA padrão: ~{tempoPreparoMedio} min ao iniciar o preparo · atualiza em tempo real
          </p>
        </div>
        {activeCount > 0 ? (
          <span className="shrink-0 rounded-full bg-[#39FF14] text-[#050508] text-xs font-bold px-2.5 py-1">
            {activeCount} ativo{activeCount === 1 ? '' : 's'}
          </span>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-7 w-7 animate-spin text-[#39FF14]" aria-label="Carregando pedidos" />
        </div>
      ) : (
        <>
          {activeOrders.length === 0 ? (
            <p className="text-sm text-white/45 rounded-xl border border-dashed border-white/15 p-6 text-center m-0">
              Nenhum pedido ativo. Quando um cliente pedir retirada pelo mapa, aparece aqui.
            </p>
          ) : (
            <ul className="space-y-3 list-none p-0 m-0">
              {activeOrders.map((order) => {
                const st = STATUS_LABEL[order.status] || STATUS_LABEL.pendente;
                const busy = actionId === order.id;
                return (
                  <li
                    key={order.id}
                    className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <span
                          className={`inline-block text-[10px] font-bold uppercase tracking-wide rounded-full border px-2 py-0.5 ${st.className}`}
                        >
                          {st.label}
                        </span>
                        <p className="text-sm font-semibold m-0 mt-2">
                          Pedido · {formatTime(order.criado_em)}
                        </p>
                        <p className="text-xs text-white/50 m-0 mt-0.5">
                          ETA{' '}
                          {order.eta_minutos_restantes != null
                            ? `~${order.eta_minutos_restantes} min`
                            : formatTime(order.eta_previsto_em)}
                          {' · '}
                          R$ {formatBrl(order.total)}
                        </p>
                      </div>
                      <OrderActions order={order} onAction={onAction} busy={busy} />
                    </div>
                    <ul className="text-xs text-white/70 space-y-1 list-none p-0 m-0 border-t border-white/10 pt-2">
                      {(order.itens || []).map((item) => (
                        <li key={item.id} className="flex justify-between gap-2">
                          <span>
                            {item.quantidade}× {item.nome}
                          </span>
                          <span className="text-white/40">R$ {formatBrl(item.subtotal)}</span>
                        </li>
                      ))}
                    </ul>
                    {order.observacao ? (
                      <p className="text-xs text-white/50 m-0 italic">“{order.observacao}”</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}

          {historyOrders.length > 0 ? (
            <details className="mt-6 text-sm text-white/50">
              <summary className="cursor-pointer hover:text-white/70">Últimos concluídos / cancelados</summary>
              <ul className="mt-3 space-y-2 list-none p-0">
                {historyOrders.map((o) => (
                  <li key={o.id} className="flex justify-between text-xs border-b border-white/5 pb-2">
                    <span>
                      {formatTime(o.criado_em)} — {STATUS_LABEL[o.status]?.label || o.status}
                    </span>
                    <span>R$ {formatBrl(o.total)}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </>
      )}
    </section>
  );
}
