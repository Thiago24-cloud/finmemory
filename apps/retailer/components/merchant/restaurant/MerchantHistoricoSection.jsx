'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  History,
  Loader2,
  Receipt,
  Search,
  Utensils,
} from 'lucide-react';
import { painelApi } from '../../../lib/merchant/painelApiPaths';
import { SkipPageHeader } from '../skip/SkipPageHeader';
import { SkipCard, SkipCardContent } from '../skip/SkipCard';
import { SkipBadge } from '../skip/SkipBadge';
import { SkipButton } from '../skip/SkipButton';

const STATUS = {
  pendente: { label: 'Pendente', className: 'text-amber-600' },
  preparando: { label: 'Preparando', className: 'text-blue-600' },
  pronto: { label: 'Pronto', className: 'text-primary' },
  concluido: { label: 'Entregue', className: 'text-muted-foreground' },
  cancelado: { label: 'Cancelado', className: 'text-destructive' },
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

const FORMA_LABEL = {
  debito: 'Débito',
  credito: 'Crédito',
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  misto: 'Misto',
};

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
      <div className="space-y-4 animate-fade-in-up">
        <SkipButton variant="ghost" size="sm" className="px-0" onClick={() => setSelectedId(null)}>
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </SkipButton>
        <SkipCard className="shadow-subtle">
          <SkipCardContent className="p-5">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold m-0">
                  {selected.mesa_numero != null ? `Mesa ${selected.mesa_numero}` : 'Balcão/Delivery'}
                </h3>
                <p className="text-xs text-muted-foreground m-0 mt-1">{formatDt(selected.criado_em)}</p>
              </div>
              <span className={`text-sm font-semibold ${st.className}`}>{st.label}</span>
            </div>
            <ul className="space-y-2 list-none p-0 m-0 mb-4">
              {(selected.itens || []).map((item, i) => (
                <li key={i} className="flex justify-between text-sm">
                  <span>
                    {item.quantidade}× {item.nome}
                  </span>
                  <span>{formatBrl(item.preco_unitario * item.quantidade)}</span>
                </li>
              ))}
            </ul>
            <div className="flex justify-between pt-3 border-t border-border">
              <span className="text-muted-foreground">Total</span>
              <span className="text-xl font-black text-primary">{formatBrl(selected.total)}</span>
            </div>
            {selected.forma_pagamento ? (
              <p className="text-sm m-0 mt-3">
                Pagamento:{' '}
                <strong>{FORMA_LABEL[selected.forma_pagamento] || selected.forma_pagamento}</strong>
              </p>
            ) : null}
            {Array.isArray(selected.pagamentos) && selected.pagamentos.length > 1 ? (
              <ul className="mt-2 space-y-1 list-none p-0 m-0 text-xs text-muted-foreground">
                {selected.pagamentos.map((p, i) => (
                  <li key={i}>
                    {i + 1}. {FORMA_LABEL[p.forma] || p.forma}:{' '}
                    {Number(p.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </li>
                ))}
              </ul>
            ) : null}
            {selected.observacao ? (
              <p className="text-xs text-muted-foreground mt-3 m-0">Obs: {selected.observacao}</p>
            ) : null}
          </SkipCardContent>
        </SkipCard>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      <SkipPageHeader
        icon={History}
        title="Histórico"
        description={`${orders.length} pedidos registrados`}
      />

      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-4">
        {Object.entries(STATUS).map(([key, cfg]) => (
          <SkipCard key={key} className="shadow-subtle">
            <SkipCardContent className="p-2 text-center">
              <p className="text-[10px] text-muted-foreground m-0">{cfg.label}</p>
              <p className="text-lg font-bold m-0">{counts[key] || 0}</p>
            </SkipCardContent>
          </SkipCard>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={mesaSearch}
            onChange={(e) => setMesaSearch(e.target.value)}
            placeholder="Buscar por mesa…"
            className="w-full rounded-xl border border-input bg-background pl-9 pr-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-input bg-background px-3 py-2 text-sm sm:w-44 focus:outline-none focus:ring-2 focus:ring-ring"
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
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Receipt className="h-12 w-12 mx-auto mb-3 opacity-50" />
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
                  className="w-full text-left rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-colors shadow-subtle"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <Utensils className="h-4 w-4 text-primary" />
                      <div>
                        <p className="font-bold text-sm m-0">
                          {order.mesa_numero != null
                            ? `Mesa ${order.mesa_numero}`
                            : order.origem === 'delivery'
                              ? 'Delivery'
                              : 'Balcão'}
                        </p>
                        <p className="text-[10px] text-muted-foreground m-0">{formatDt(order.criado_em)}</p>
                      </div>
                    </div>
                    <SkipBadge className={`border-0 bg-transparent ${st.className}`}>{st.label}</SkipBadge>
                  </div>
                  <div className="flex justify-between mt-2 pt-2 border-t border-border">
                    <span className="text-xs text-muted-foreground">
                      {(order.itens || []).length} itens
                    </span>
                    <span className="font-bold text-primary">{formatBrl(order.total)}</span>
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
