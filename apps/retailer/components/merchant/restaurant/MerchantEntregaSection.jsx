'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Settings, Truck } from 'lucide-react';
import { painelApi } from '../../../lib/merchant/painelApiPaths';
import { usePedidosLojaRealtime } from '../../../hooks/usePedidosLojaRealtime';
import { SkipCard, SkipCardContent } from '../skip/SkipCard';
import { SkipButton } from '../skip/SkipButton';

const STATUS = {
  pendente: { label: 'Pendente', card: 'border-amber-500/50 bg-amber-500/5 shadow-subtle' },
  preparando: { label: 'Preparando', card: 'border-blue-500/50 bg-blue-500/5 shadow-subtle' },
  pronto: { label: 'Pronto', card: 'border-primary/50 bg-primary/5 shadow-subtle' },
  concluido: { label: 'Entregue', card: 'border-border bg-muted/30 shadow-subtle' },
  cancelado: { label: 'Cancelado', card: 'border-destructive/30 bg-destructive/5 shadow-subtle' },
};

function formatBrl(v) {
  return `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;
}

function formatTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

export function MerchantEntregaSection({ lojaId }) {
  const [orders, setOrders] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [showConfig, setShowConfig] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ordRes, cfgRes] = await Promise.all([
        fetch(`${painelApi.pedidos}?scope=entrega&limit=50`),
        fetch(painelApi.entregaConfig),
      ]);
      const ordJson = await ordRes.json().catch(() => ({}));
      const cfgJson = await cfgRes.json().catch(() => ({}));
      if (ordRes.ok) setOrders(ordJson.orders || []);
      if (cfgRes.ok) setConfig(cfgJson.delivery || {});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  usePedidosLojaRealtime(lojaId, load);

  const filtered = useMemo(() => {
    if (tab === 'all') return orders;
    return orders.filter((o) => o.status === tab);
  }, [orders, tab]);

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

  const saveConfig = async () => {
    setSaving(true);
    try {
      await fetch(painelApi.entregaConfig, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delivery: config }),
      });
      setShowConfig(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const pendingCount = orders.filter((o) => o.status === 'pendente').length;
  const manualAtivo = Boolean(config?.manual_ativo);

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 m-0">
            <Truck className="w-7 h-7 text-primary" />
            Entrega
          </h1>
          <p className="text-sm text-muted-foreground mt-1 m-0">Pedidos delivery — entrega manual.</p>
        </div>
        <SkipButton variant="outline" size="icon" onClick={() => setShowConfig(true)} title="Configurações">
          <Settings className="h-5 w-5" />
        </SkipButton>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <SkipCard className="shadow-subtle">
          <SkipCardContent className="p-3">
            <p className="text-[10px] text-muted-foreground m-0">Entrega manual</p>
            <p className={`text-lg font-bold m-0 mt-1 ${manualAtivo ? 'text-primary' : 'text-muted-foreground'}`}>
              {manualAtivo ? 'Ativa' : 'Desativada'}
            </p>
          </SkipCardContent>
        </SkipCard>
        <SkipCard className="shadow-subtle">
          <SkipCardContent className="p-3">
            <p className="text-[10px] text-muted-foreground m-0">Pendentes</p>
            <p className="text-2xl font-bold m-0 mt-1">{pendingCount}</p>
          </SkipCardContent>
        </SkipCard>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1 mb-4 hide-scrollbar">
        {[
          { key: 'all', label: 'Todos' },
          { key: 'pendente', label: 'Pendentes' },
          { key: 'preparando', label: 'Preparando' },
          { key: 'pronto', label: 'Prontos' },
          { key: 'concluido', label: 'Entregues' },
        ].map((f) => (
          <SkipButton
            key={f.key}
            size="sm"
            variant={tab === f.key ? 'default' : 'outline'}
            onClick={() => setTab(f.key)}
            className="shrink-0"
          >
            {f.label}
          </SkipButton>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Truck className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="m-0 text-sm">Nenhum pedido de entrega.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((order) => {
            const meta = STATUS[order.status] || STATUS.pendente;
            const busy = actionId === order.id;
            return (
              <SkipCard key={order.id} className={meta.card}>
                <SkipCardContent className="p-4">
                  <div className="flex justify-between mb-2">
                    <span className="font-bold">Delivery</span>
                    <span className="text-xs text-muted-foreground">{formatTime(order.criado_em)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground m-0 mb-2">{meta.label}</p>
                  <ul className="space-y-1 list-none p-0 m-0 mb-3">
                    {(order.itens || []).map((item, i) => (
                      <li key={i} className="text-sm">
                        {item.quantidade}× {item.nome}
                      </li>
                    ))}
                  </ul>
                  <p className="font-bold text-primary mb-3 m-0">{formatBrl(order.total)}</p>
                  <div className="flex flex-wrap gap-2">
                    {order.status === 'pendente' ? (
                      <SkipButton disabled={busy} onClick={() => void updateStatus(order.id, 'preparando')} className="flex-1" size="sm">
                        Preparar
                      </SkipButton>
                    ) : null}
                    {order.status === 'preparando' ? (
                      <SkipButton disabled={busy} variant="outline" onClick={() => void updateStatus(order.id, 'pronto')} className="flex-1" size="sm">
                        Pronto p/ entrega
                      </SkipButton>
                    ) : null}
                    {order.status === 'pronto' ? (
                      <SkipButton disabled={busy} variant="outline" onClick={() => void updateStatus(order.id, 'concluido')} className="flex-1" size="sm">
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

      {showConfig ? (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-black/40" onClick={() => !saving && setShowConfig(false)} />
          <SkipCard className="relative w-full max-w-md z-10">
            <SkipCardContent className="p-5">
              <h3 className="text-lg font-bold m-0 mb-4">Entrega manual</h3>
              <label className="flex items-center gap-2 mb-4 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(config?.manual_ativo)}
                  onChange={(e) => setConfig((c) => ({ ...c, manual_ativo: e.target.checked }))}
                  className="accent-primary"
                />
                Aceitar pedidos de delivery
              </label>
              <label className="block text-xs text-muted-foreground mb-1">Taxa de entrega (R$)</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={config?.taxa ?? 0}
                onChange={(e) => setConfig((c) => ({ ...c, taxa: Number(e.target.value) }))}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <label className="block text-xs text-muted-foreground mb-1">Tempo estimado (min)</label>
              <input
                type="number"
                min="15"
                max="180"
                value={config?.tempo_minutos ?? 45}
                onChange={(e) => setConfig((c) => ({ ...c, tempo_minutos: Number(e.target.value) }))}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <SkipButton disabled={saving} onClick={() => void saveConfig()} className="w-full">
                Salvar
              </SkipButton>
            </SkipCardContent>
          </SkipCard>
        </div>
      ) : null}
    </div>
  );
}
