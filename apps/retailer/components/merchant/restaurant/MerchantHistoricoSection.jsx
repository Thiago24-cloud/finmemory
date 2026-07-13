'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ChefHat,
  Clock,
  History,
  Loader2,
  Receipt,
  Search,
  Utensils,
  XCircle,
} from 'lucide-react';
import { painelApi } from '../../../lib/merchant/painelApiPaths';

const STATUS = {
  pendente: { label: 'Pendente', className: 'text-amber-400' },
  preparando: { label: 'Preparando', className: 'text-blue-400' },
  pronto: { label: 'Pronto', className: 'text-[#39FF14]' },
  concluido: { label: 'Entregue', className: 'text-white/60' },
  cancelado: { label: 'Cancelado', className: 'text-red-400' },
};

function formatBrl(v) {
  return `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;
}

function formatDt(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export function MerchantHistoricoSection() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [mesaSearch, setMesaSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ scope: 'historico', limit: '100' });
      if (statusFilter !== 'all') qs.set('status', statusFilter);
      const res = await fetch(`${painelApi.pedidos}?${qs}`);
      const json = await res.json().catch(() => ({}));
      if (res.ok) setOrders(json.orders || []);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (mesaSearch.trim() && o.mesa_numero != null) {
        if (!String(o.mesa_numero).includes(mesaSearch.trim())) return false;
      }
      return true;
    });
  }, [orders, mesaSearch]);

  const selected = selectedId ? orders.find((o) => o.id === selectedId) : null;

  const counts = useMemo(() => {
    const c = {};
    for (const o of orders) c[o.status] = (c[o.status] || 0) + 1;
    return c;
  }, [orders]);

  if (selected) {
    const st = STATUS[selected.status] || STATUS.pendente;
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          className="inline-flex items-center gap-1 text-sm text-[#39FF14] bg-transparent border-0 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>
        <article className="rounded-2xl border border-white/10 p-5">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-bold m-0 text-white">
                {selected.mesa_numero != null ? `Mesa ${selected.mesa_numero}` : 'Balcão/Delivery'}
              </h3>
              <p className="text-xs text-white/50 m-0 mt-1">{formatDt(selected.criado_em)}</p>
            </div>
            <span className={`text-sm font-semibold ${st.className}`}>{st.label}</span>
          </div>
          <ul className="space-y-2 list-none p-0 m-0 mb-4">
            {(selected.itens || []).map((item, i) => (
              <li key={i} className="flex justify-between text-sm text-white/80">
                <span>
                  {item.quantidade}× {item.nome}
                </span>
                <span>{formatBrl(item.preco_unitario * item.quantidade)}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between pt-3 border-t border-white/10">
            <span className="text-white/60">Total</span>
            <span className="text-xl font-black text-[#39FF14]">{formatBrl(selected.total)}</span>
          </div>
          {selected.observacao ? (
            <p className="text-xs text-white/40 mt-3 m-0">Obs: {selected.observacao}</p>
          ) : null}
        </article>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold m-0 text-white flex items-center gap-2">
          <History className="h-5 w-5 text-[#39FF14]" />
          Histórico
        </h2>
        <p className="text-xs text-white/50 mt-2 m-0">{orders.length} pedidos registrados</p>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {Object.entries(STATUS).map(([key, cfg]) => (
          <div
            key={key}
            className="rounded-xl border border-white/10 bg-white/[0.03] p-2 text-center"
          >
            <p className="text-[10px] text-white/50 m-0">{cfg.label}</p>
            <p className="text-lg font-bold text-white m-0">{counts[key] || 0}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <input
            value={mesaSearch}
            onChange={(e) => setMesaSearch(e.target.value)}
            placeholder="Buscar por mesa…"
            className="w-full rounded-xl border border-white/15 bg-white/5 pl-9 pr-3 py-2 text-sm text-white placeholder:text-white/30"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white sm:w-44"
        >
          <option value="all">Todos os status</option>
          {Object.entries(STATUS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[#39FF14]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-white/50">
          <Receipt className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="m-0 text-sm">Nenhum pedido encontrado.</p>
        </div>
      ) : (
        <ul className="space-y-2 list-none p-0 m-0">
          {filtered.map((order) => {
            const st = STATUS[order.status] || STATUS.pendente;
            return (
              <li key={order.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(order.id)}
                  className="w-full text-left rounded-2xl border border-white/10 bg-white/[0.03] p-4 hover:border-[#39FF14]/30 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <Utensils className="h-4 w-4 text-[#39FF14]" />
                      <div>
                        <p className="font-bold text-sm text-white m-0">
                          {order.mesa_numero != null
                            ? `Mesa ${order.mesa_numero}`
                            : order.origem === 'delivery'
                              ? 'Delivery'
                              : 'Balcão'}
                        </p>
                        <p className="text-[10px] text-white/40 m-0">{formatDt(order.criado_em)}</p>
                      </div>
                    </div>
                    <span className={`text-xs font-semibold ${st.className}`}>{st.label}</span>
                  </div>
                  <div className="flex justify-between mt-2 pt-2 border-t border-white/5">
                    <span className="text-xs text-white/50">
                      {(order.itens || []).length} itens
                    </span>
                    <span className="font-bold text-[#39FF14]">{formatBrl(order.total)}</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
