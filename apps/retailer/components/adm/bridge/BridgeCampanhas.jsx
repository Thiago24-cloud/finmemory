'use client';

import { useCallback, useEffect, useState } from 'react';
import { Calendar, PlusCircle, Tag } from 'lucide-react';
import { fmtCurrency } from '../../../lib/adm/bridgeFormat';

const STATUS_LABELS = {
  active: 'Ativa',
  draft: 'Rascunho',
  paused: 'Pausada',
  ended: 'Encerrada',
};

const STATUS_COLORS = {
  active: 'bg-green-100 text-green-800 border-green-200',
  draft: 'bg-gray-100 text-gray-800 border-gray-200',
  paused: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  ended: 'bg-red-100 text-red-800 border-red-200',
};

export function BridgeCampanhas({ onNovaCampanha, onValidar }) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const res = await fetch('/api/parceiros/adm/campaigns');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
      setCampaigns(data.campaigns || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(id, status) {
    try {
      const res = await fetch(`/api/parceiros/adm/campaigns/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      load();
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Campanhas</h2>
          <p className="text-muted-foreground">Gerencie campanhas de parceiros e acompanhe o orçamento.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onValidar}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Validar compra
          </button>
          <button
            type="button"
            onClick={onNovaCampanha}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            <PlusCircle className="w-4 h-4" /> Nova Campanha
          </button>
        </div>
      </div>

      {err ? <p className="text-sm text-destructive">{err}</p> : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">A carregar…</p>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-border rounded-xl">
          <Tag className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-1">Nenhuma campanha</h3>
          <p className="text-muted-foreground mb-4">Crie sua primeira campanha para começar.</p>
          <button
            type="button"
            onClick={onNovaCampanha}
            className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted"
          >
            Criar primeira campanha
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {campaigns.map((c) => {
            const pct = c.budget_total > 0 ? (c.budget_spent / c.budget_total) * 100 : 0;
            return (
              <div key={c.id} className="rounded-xl border border-border bg-card flex flex-col overflow-hidden">
                <div className="p-4 pb-3 border-b border-border">
                  <div className="flex justify-between items-start mb-2">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[c.status] || 'bg-muted'}`}
                    >
                      {STATUS_LABELS[c.status] || c.status}
                    </span>
                    <span className="text-xs font-mono text-muted-foreground">ID: {c.id}</span>
                  </div>
                  <h3 className="text-lg font-semibold">{c.name}</h3>
                  <p className="text-sm text-primary mt-1">Parceiro: {c.partner_name}</p>
                </div>
                <div className="p-4 flex-1 space-y-3">
                  <div className="bg-muted/50 p-3 rounded-md text-sm space-y-1">
                    <p className="flex justify-between">
                      <span className="text-muted-foreground">Produto:</span>
                      <span>{c.product_name}</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-muted-foreground">Recompensa:</span>
                      <span className="text-green-600 font-medium">{fmtCurrency(c.reward_amount)}</span>
                    </p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm font-medium">
                      <span>Orçamento Utilizado</span>
                      <span>{Math.round(pct)}%</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{fmtCurrency(c.budget_spent)}</span>
                      <span>{fmtCurrency(c.budget_total)}</span>
                    </div>
                  </div>
                </div>
                <div className="px-4 py-3 border-t border-border bg-muted/20 flex flex-wrap gap-2 items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {c.region || 'Sem região'}
                  </span>
                  <div className="flex gap-1">
                    {['draft', 'active', 'paused', 'ended']
                      .filter((s) => s !== c.status)
                      .map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setStatus(c.id, s)}
                          className="text-[10px] rounded border border-border px-2 py-0.5 hover:bg-muted"
                        >
                          → {STATUS_LABELS[s]}
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
