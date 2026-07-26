'use client';

import { useCallback, useEffect, useState } from 'react';
import { useBridgeContext } from './BridgeContext';
import { fmtCurrency } from '../../../lib/adm/bridgeFormat';

export function BridgeValidar({ onBack }) {
  const { selectedMerchant, merchants } = useBridgeContext();
  const [campaigns, setCampaigns] = useState([]);
  const [form, setForm] = useState({
    user_id: '',
    campaign_id: '',
    product_name: '',
    product_brand: '',
    market_name: 'Atacadão',
    purchase_amount: '12.99',
  });
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/parceiros/adm/campaigns?status=active')
      .then((r) => r.json())
      .then((d) => {
        const list = d.campaigns || [];
        setCampaigns(list);
        if (list[0]) {
          setForm((f) => ({
            ...f,
            campaign_id: f.campaign_id || list[0].id,
            product_name: f.product_name || list[0].product_name,
          }));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedMerchant?.user_id) {
      setForm((f) => ({ ...f, user_id: selectedMerchant.user_id }));
    }
  }, [selectedMerchant?.user_id]);

  const validate = useCallback(
    async (e) => {
      e?.preventDefault();
      setErr('');
      setResult(null);
      setLoading(true);
      try {
        const res = await fetch('/api/parceiros/adm/campaigns/validate-purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...form,
            purchase_amount: Number(form.purchase_amount),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Falha');
        setResult(data);
      } catch (ex) {
        setErr(ex.message);
      } finally {
        setLoading(false);
      }
    },
    [form]
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Validar Compra</h2>
          <p className="text-muted-foreground">Concede crédito da campanha ao comerciante selecionado.</p>
        </div>
        {onBack ? (
          <button type="button" onClick={onBack} className="text-sm text-primary hover:underline">
            ← Voltar
          </button>
        ) : null}
      </div>

      <form onSubmit={validate} className="rounded-xl border border-border bg-card p-5 space-y-4">
        <label className="block text-sm">
          <span className="text-muted-foreground">Comerciante</span>
          <select
            required
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
            value={form.user_id}
            onChange={(e) => setForm((f) => ({ ...f, user_id: e.target.value }))}
          >
            <option value="">Selecione…</option>
            {merchants.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.store_name || m.name} — {m.email}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground">Campanha ativa</span>
          <select
            required
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
            value={form.campaign_id}
            onChange={(e) => {
              const c = campaigns.find((x) => x.id === e.target.value);
              setForm((f) => ({
                ...f,
                campaign_id: e.target.value,
                product_name: c?.product_name || f.product_name,
              }));
            }}
          >
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {fmtCurrency(c.reward_amount)}
              </option>
            ))}
          </select>
        </label>
        {[
          ['product_name', 'Produto comprado'],
          ['product_brand', 'Marca'],
          ['market_name', 'Mercado'],
          ['purchase_amount', 'Valor pago (R$)'],
        ].map(([key, label]) => (
          <label key={key} className="block text-sm">
            <span className="text-muted-foreground">{label}</span>
            <input
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
              value={form[key]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
            />
          </label>
        ))}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {loading ? 'Validando…' : 'Validar e conceder crédito'}
        </button>
      </form>

      {err ? <p className="text-sm text-destructive">{err}</p> : null}
      {result ? (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 text-sm space-y-2">
          <p className="font-semibold">{result.message}</p>
          <p>
            Novo saldo: <strong>{fmtCurrency(result.balance)}</strong>
          </p>
          {result.transaction?.blockchain_tx_hash ? (
            <p className="font-mono text-xs break-all text-muted-foreground">
              Hash audit: {result.transaction.blockchain_tx_hash}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
