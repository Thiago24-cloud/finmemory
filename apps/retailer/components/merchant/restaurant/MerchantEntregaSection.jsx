'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Loader2,
  PackageCheck,
  Settings,
  Truck,
} from 'lucide-react';
import { painelApi } from '../../../lib/merchant/painelApiPaths';
import { usePedidosLojaRealtime } from '../../../hooks/usePedidosLojaRealtime';

const STATUS = {
  pendente: { label: 'Pendente', color: 'border-amber-500/50 bg-amber-500/10' },
  preparando: { label: 'Preparando', color: 'border-blue-500/50 bg-blue-500/10' },
  pronto: { label: 'Pronto', color: 'border-[#39FF14]/50 bg-[#39FF14]/10' },
  concluido: { label: 'Entregue', color: 'border-white/20 bg-white/5' },
  cancelado: { label: 'Cancelado', color: 'border-red-500/30 bg-red-500/10' },
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
  const [integrations, setIntegrations] = useState([]);
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
      if (cfgRes.ok) {
        setConfig(cfgJson.delivery || {});
        setIntegrations(cfgJson.integrations || []);
      }
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

  const saveIntegration = async (integration) => {
    setSaving(true);
    try {
      await fetch(painelApi.entregaConfig, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integration }),
      });
      await load();
    } finally {
      setSaving(false);
    }
  };

  const activeIntegrations = integrations.filter((i) => i.is_active).length;
  const pendingCount = orders.filter((o) => o.status === 'pendente').length;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold m-0 text-white flex items-center gap-2">
            <Truck className="h-5 w-5 text-[#39FF14]" />
            Entrega
          </h2>
          <p className="text-xs text-white/50 mt-2 m-0">Pedidos delivery e integrações.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowConfig(true)}
          className="rounded-xl border border-white/15 p-2 text-white/60 hover:text-white"
          title="Configurações"
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 flex items-center gap-3">
          <PackageCheck className="h-8 w-8 text-[#39FF14]" />
          <div>
            <p className="text-2xl font-bold text-white m-0">{activeIntegrations}</p>
            <p className="text-[10px] text-white/50 m-0">Integrações ativas</p>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 flex items-center gap-3">
          <Truck className="h-8 w-8 text-amber-400" />
          <div>
            <p className="text-2xl font-bold text-white m-0">{pendingCount}</p>
            <p className="text-[10px] text-white/50 m-0">Pendentes</p>
          </div>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1">
        {[
          { key: 'all', label: 'Todos' },
          { key: 'pendente', label: 'Pendentes' },
          { key: 'preparando', label: 'Preparando' },
          { key: 'pronto', label: 'Prontos' },
          { key: 'concluido', label: 'Entregues' },
        ].map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setTab(f.key)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold ${
              tab === f.key
                ? 'bg-[#39FF14] text-[#050508]'
                : 'bg-white/5 text-white/60 border border-white/10'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[#39FF14]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-white/50">
          <Truck className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="m-0 text-sm">Nenhum pedido de entrega.</p>
          <p className="text-[10px] mt-2 m-0">iFood, 99Food e entrega manual aparecem aqui.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((order) => {
            const meta = STATUS[order.status] || STATUS.pendente;
            const busy = actionId === order.id;
            return (
              <article key={order.id} className={`rounded-2xl border p-4 ${meta.color}`}>
                <div className="flex justify-between mb-2">
                  <span className="font-bold text-white">Delivery</span>
                  <span className="text-xs text-white/50">{formatTime(order.criado_em)}</span>
                </div>
                <p className="text-xs text-white/70 m-0 mb-2">{meta.label}</p>
                <ul className="space-y-1 list-none p-0 m-0 mb-3">
                  {(order.itens || []).map((item, i) => (
                    <li key={i} className="text-sm text-white/90">
                      {item.quantidade}× {item.nome}
                    </li>
                  ))}
                </ul>
                <p className="font-bold text-[#39FF14] mb-3 m-0">{formatBrl(order.total)}</p>
                <div className="flex flex-wrap gap-2">
                  {order.status === 'pendente' ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void updateStatus(order.id, 'preparando')}
                      className="flex-1 rounded-lg bg-[#39FF14] py-2 text-xs font-bold text-[#050508]"
                    >
                      Preparar
                    </button>
                  ) : null}
                  {order.status === 'preparando' ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void updateStatus(order.id, 'pronto')}
                      className="flex-1 rounded-lg border border-[#39FF14]/50 py-2 text-xs text-[#39FF14]"
                    >
                      Pronto p/ entrega
                    </button>
                  ) : null}
                  {order.status === 'pronto' ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void updateStatus(order.id, 'concluido')}
                      className="flex-1 rounded-lg border border-white/25 py-2 text-xs text-white/80"
                    >
                      Entregue
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {showConfig ? (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            onClick={() => !saving && setShowConfig(false)}
          />
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0f0f14] p-5">
            <h3 className="text-lg font-bold text-white m-0 mb-4">Configurações de entrega</h3>

            <label className="flex items-center gap-2 mb-4 text-sm text-white">
              <input
                type="checkbox"
                checked={Boolean(config?.manual_ativo)}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, manual_ativo: e.target.checked }))
                }
              />
              Entrega manual ativa
            </label>

            <label className="block text-xs text-white/50 mb-1">Taxa de entrega (R$)</label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={config?.taxa ?? 0}
              onChange={(e) => setConfig((c) => ({ ...c, taxa: Number(e.target.value) }))}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white mb-4"
            />

            <label className="block text-xs text-white/50 mb-1">Tempo estimado (min)</label>
            <input
              type="number"
              min="15"
              max="180"
              value={config?.tempo_minutos ?? 45}
              onChange={(e) =>
                setConfig((c) => ({ ...c, tempo_minutos: Number(e.target.value) }))
              }
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white mb-6"
            />

            <p className="text-xs font-bold text-white/70 mb-2 m-0">Integrações</p>
            <div className="space-y-3 mb-6">
              {integrations.map((integ) => (
                <div key={integ.id} className="rounded-xl border border-white/10 p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-white text-sm">{integ.nome}</span>
                    <label className="flex items-center gap-1 text-xs text-white/60">
                      <input
                        type="checkbox"
                        checked={Boolean(integ.is_active)}
                        onChange={(e) => {
                          const updated = { ...integ, is_active: e.target.checked };
                          setIntegrations((prev) =>
                            prev.map((i) => (i.id === integ.id ? updated : i))
                          );
                          void saveIntegration({
                            id: integ.id,
                            is_active: e.target.checked,
                          });
                        }}
                      />
                      Ativo
                    </label>
                  </div>
                  <input
                    placeholder="Merchant ID"
                    value={integ.merchant_id || ''}
                    onChange={(e) =>
                      setIntegrations((prev) =>
                        prev.map((i) =>
                          i.id === integ.id ? { ...i, merchant_id: e.target.value } : i
                        )
                      )
                    }
                    onBlur={() =>
                      void saveIntegration({
                        id: integ.id,
                        merchant_id: integ.merchant_id,
                        client_id: integ.client_id,
                        is_active: integ.is_active,
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white mb-1"
                  />
                </div>
              ))}
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={() => void saveConfig()}
              className="w-full rounded-xl bg-[#39FF14] py-3 font-bold text-[#050508]"
            >
              Salvar configurações
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
