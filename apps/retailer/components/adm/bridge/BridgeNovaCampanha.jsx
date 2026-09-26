'use client';

import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';

const STATUS_OPTIONS = ['draft', 'active', 'paused', 'ended'];

export function BridgeNovaCampanha({ onBack, onCreated }) {
  const [form, setForm] = useState({
    name: '',
    partner_name: '',
    product_name: '',
    product_brand: '',
    reward_amount: '2.00',
    budget_total: '1000.00',
    region: 'São Paulo',
    status: 'draft',
  });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const res = await fetch('/api/parceiros/adm/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          reward_amount: Number(form.reward_amount),
          budget_total: Number(form.budget_total),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao criar');
      onCreated?.();
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <button type="button" onClick={onBack} className="p-2 rounded-full hover:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Nova Campanha</h2>
          <p className="text-muted-foreground">Lance uma campanha de recompensas patrocinada.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ['name', 'Nome da campanha'],
            ['partner_name', 'Parceiro / Indústria'],
            ['product_name', 'Produto'],
            ['product_brand', 'Marca (opcional)'],
            ['reward_amount', 'Recompensa por validação (R$)'],
            ['budget_total', 'Orçamento total (R$)'],
            ['region', 'Região'],
          ].map(([key, label]) => (
            <label key={key} className="block text-sm">
              <span className="text-muted-foreground">{label}</span>
              <input
                required={!label.includes('opcional')}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              />
            </label>
          ))}
          <label className="block text-sm">
            <span className="text-muted-foreground">Status inicial</span>
            <select
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>
        {err ? <p className="text-sm text-destructive">{err}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {loading ? 'Criando…' : 'Criar Campanha'}
        </button>
      </form>
    </div>
  );
}
