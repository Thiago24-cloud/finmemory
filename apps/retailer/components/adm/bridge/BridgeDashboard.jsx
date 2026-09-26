'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Tag, TrendingUp, Wallet } from 'lucide-react';
import { fmtCurrency } from '../../../lib/adm/bridgeFormat';

const TYPE_LABELS = {
  credit_issued: 'Crédito recebido',
  cashback_granted: 'Cashback',
  campaign_reward: 'Recompensa de campanha',
  credit_redeemed: 'Crédito utilizado',
  admin_adjustment: 'Ajuste administrativo',
};

export function BridgeDashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr('');
      try {
        const res = await fetch('/api/parceiros/adm/bridge/dashboard');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
        if (!cancelled) setSummary(data);
      } catch (e) {
        if (!cancelled) setErr(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (err) return <p className="text-sm text-destructive">{err}</p>;
  if (!summary) return null;

  const cards = [
    { label: 'Total de Créditos', value: fmtCurrency(summary.total_credit_issued), icon: Wallet },
    { label: 'Campanhas Ativas', value: summary.active_campaigns, icon: Tag },
    { label: 'Validações', value: summary.total_validations, icon: CheckCircle2 },
    { label: 'Estabelecimentos', value: summary.total_merchants, icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl fm-bridge-page-title">Visão Geral</h1>
        <p className="fm-bridge-page-sub">Acompanhe o desempenho das campanhas e créditos.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="fm-bridge-card p-4">
            <div className="flex items-center justify-between pb-2">
              <span className="text-sm font-medium">{label}</span>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="fm-bridge-card p-4 space-y-4">
          <div>
            <h3 className="font-semibold">Orçamento das Campanhas</h3>
            <p className="text-sm text-muted-foreground">Uso do orçamento disponível</p>
          </div>
          {summary.campaigns_budget_usage.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma campanha ativa.</p>
          ) : (
            summary.campaigns_budget_usage.map((c) => {
              const pct = c.budget_total > 0 ? (c.budget_spent / c.budget_total) * 100 : 0;
              return (
                <div key={c.id} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium truncate pr-4">{c.name}</span>
                    <span className="text-muted-foreground whitespace-nowrap">
                      {fmtCurrency(c.budget_spent)} / {fmtCurrency(c.budget_total)}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="fm-bridge-card p-4 space-y-4">
          <div>
            <h3 className="font-semibold">Últimas Transações</h3>
            <p className="text-sm text-muted-foreground">Movimentações recentes na rede</p>
          </div>
          {summary.recent_transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma transação recente.</p>
          ) : (
            summary.recent_transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between border-b border-border pb-2 last:border-0 last:pb-0"
              >
                <div>
                  <p className="text-sm font-medium">{TYPE_LABELS[tx.type] || tx.type}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(tx.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <span className={`font-medium ${tx.amount > 0 ? 'text-green-600' : ''}`}>
                  {tx.amount > 0 ? '+' : ''}
                  {fmtCurrency(tx.amount)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
