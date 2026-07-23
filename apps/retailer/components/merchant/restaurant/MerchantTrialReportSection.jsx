'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  CircleAlert,
  Loader2,
  PauseCircle,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { painelApi } from '../../../lib/merchant/painelApiPaths';
import { PlanLockedNotice } from '../PlanLockedNotice';
import { SkipPageHeader } from '../skip/SkipPageHeader';
import { SkipCard, SkipCardContent } from '../skip/SkipCard';
import { SkipButton } from '../skip/SkipButton';

function pct(rate) {
  if (rate == null || !Number.isFinite(Number(rate))) return '—';
  return `${Math.round(Number(rate) * 100)}%`;
}

function brl(n) {
  return Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const VERDICT_STYLE = {
  funcionou_bem: {
    box: 'border-emerald-200 bg-emerald-50 text-emerald-950',
    Icon: CheckCircle2,
  },
  precisa_melhorar: {
    box: 'border-amber-200 bg-amber-50 text-amber-950',
    Icon: CircleAlert,
  },
  nao_validou: {
    box: 'border-slate-200 bg-slate-50 text-slate-900',
    Icon: PauseCircle,
  },
};

function Metric({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground m-0">{label}</p>
      <p className="text-lg font-bold m-0 mt-1 tabular-nums">{value}</p>
      {hint ? <p className="text-[10px] text-muted-foreground m-0 mt-0.5">{hint}</p> : null}
    </div>
  );
}

/**
 * Relatório de validação do trial (30 dias).
 */
export function MerchantTrialReportSection() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [locked, setLocked] = useState(null);
  const [saving, setSaving] = useState(false);
  const [useMock, setUseMock] = useState(false);

  const load = useCallback(async (mock = false) => {
    setLoading(true);
    setError('');
    setLocked(null);
    try {
      const qs = mock ? '?mock=1' : '';
      const res = await fetch(`${painelApi.trialReport}${qs}`);
      const json = await res.json().catch(() => ({}));
      if (res.status === 403 && json.code === 'FEATURE_LOCKED') {
        setLocked(json);
        setReport(null);
        return;
      }
      if (!res.ok) {
        setError(json.error || 'Não foi possível carregar o relatório.');
        return;
      }
      setReport(json);
      setUseMock(Boolean(json.mock));
    } catch {
      setError('Erro de rede.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const saveWilling = async (value) => {
    setSaving(true);
    try {
      const res = await fetch(painelApi.trialReport, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ willing_to_pay: value }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || 'Falha ao salvar.');
        return;
      }
      await load(useMock);
    } finally {
      setSaving(false);
    }
  };

  if (locked) {
    return (
      <div className="animate-fade-in-up">
        <SkipPageHeader
          icon={BarChart3}
          title="Validação 30 dias"
          description="Resultados do trial FinMemory."
        />
        <PlanLockedNotice
          featureLabel="Relatórios"
          requiredPlanName={locked.required_plan_name || 'Estoque e Margem'}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !report) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive m-0">{error}</p>
        <SkipButton variant="outline" size="sm" onClick={() => void load(true)}>
          Ver exemplo com dados mockados
        </SkipButton>
      </div>
    );
  }

  if (!report) return null;

  const { trial, metrics, evaluation, criteria } = report;
  const verdictKey = evaluation?.verdict || 'nao_validou';
  const style = VERDICT_STYLE[verdictKey] || VERDICT_STYLE.nao_validou;
  const VerdictIcon = style.Icon;

  return (
    <div className="animate-fade-in-up space-y-4">
      <SkipPageHeader
        icon={BarChart3}
        title="Validação 30 dias"
        description="Mede se o teste FinMemory está validando QR, clientes e pedidos diretos."
      />

      <div className="flex flex-wrap gap-2">
        <SkipButton variant="outline" size="sm" onClick={() => void load(false)}>
          <RefreshCw className="h-3.5 w-3.5" />
          Atualizar
        </SkipButton>
        <SkipButton variant="outline" size="sm" onClick={() => void load(true)}>
          <Sparkles className="h-3.5 w-3.5" />
          Exemplo mock
        </SkipButton>
      </div>

      {useMock ? (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 m-0">
          Exibindo dados de demonstração (mock). Clique em Atualizar para ver dados reais.
        </p>
      ) : null}

      {error ? <p className="text-xs text-destructive m-0">{error}</p> : null}

      <div className={`rounded-2xl border px-4 py-4 ${style.box}`}>
        <div className="flex items-start gap-3">
          <VerdictIcon className="h-6 w-6 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs uppercase tracking-wide opacity-70 m-0">Resumo executivo</p>
            <h2 className="text-lg font-bold m-0 mt-0.5">{evaluation.verdict_label}</h2>
            <p className="text-sm m-0 mt-2">
              Recomendação: <strong>{evaluation.recommendation_label}</strong>
            </p>
            <p className="text-xs m-0 mt-1 opacity-80">
              Critérios atendidos: {evaluation.passed}/{evaluation.total}
              {trial?.days_remaining != null
                ? ` · ${trial.days_remaining} dia(s) restantes de trial`
                : ''}
            </p>
          </div>
        </div>
      </div>

      <SkipCard className="shadow-subtle">
        <SkipCardContent className="p-4 space-y-3">
          <p className="text-sm font-bold m-0">Critérios de validação</p>
          <ul className="space-y-2 list-none p-0 m-0">
            {(evaluation.checks || []).map((c) => (
              <li key={c.key} className="flex items-start gap-2 text-sm">
                {c.skipped ? (
                  <span className="text-muted-foreground">—</span>
                ) : c.ok ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <CircleAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                )}
                <span>
                  {c.label}
                  {!c.skipped && c.key !== 'willing_to_pay' ? (
                    <span className="text-muted-foreground">
                      {' '}
                      ({c.value}/{c.target})
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground m-0 mb-2">
              Lojista disposto a pagar após o trial?
            </p>
            <div className="flex gap-2">
              <SkipButton
                size="sm"
                disabled={saving}
                variant={trial?.willing_to_pay === true ? 'default' : 'outline'}
                onClick={() => void saveWilling(true)}
              >
                Sim
              </SkipButton>
              <SkipButton
                size="sm"
                disabled={saving}
                variant={trial?.willing_to_pay === false ? 'default' : 'outline'}
                onClick={() => void saveWilling(false)}
              >
                Ainda não
              </SkipButton>
            </div>
            <p className="text-[10px] text-muted-foreground m-0 mt-2">
              Meta padrão: ≥{criteria.min_customers} clientes, ≥{criteria.min_direct_orders}{' '}
              pedidos, ≥{criteria.min_recurring_customers} recorrentes
              {criteria.require_willing_to_pay ? ', disposição a pagar' : ''}.
            </p>
          </div>
        </SkipCardContent>
      </SkipCard>

      <div>
        <p className="text-sm font-bold m-0 mb-2 flex items-center gap-2">
          <TrendingUp className="h-4 w-4" /> Métricas do período
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Metric label="Dias restantes" value={trial?.days_remaining ?? '—'} />
          <Metric label="Scans QR" value={metrics.qr_scans} />
          <Metric label="Views página" value={metrics.page_views} />
          <Metric label="Clientes" value={metrics.customers_registered} />
          <Metric label="Pedidos iniciados" value={metrics.orders_started} />
          <Metric label="Pedidos concluídos" value={metrics.orders_completed} />
          <Metric label="Conv. scan→cadastro" value={pct(metrics.conversion_scan_to_customer)} />
          <Metric label="Conv. cadastro→pedido" value={pct(metrics.conversion_customer_to_order)} />
          <Metric label="Retirada" value={metrics.orders_pickup} />
          <Metric label="Entrega local" value={metrics.orders_delivery} />
          <Metric label="Receita direta" value={brl(metrics.direct_revenue)} />
          <Metric label="Ticket médio" value={brl(metrics.avg_ticket)} />
          <Metric label="Clientes recorrentes" value={metrics.recurring_customers} />
          <Metric
            label="Economia vs marketplace"
            value={brl(metrics.estimated_marketplace_savings)}
            hint={`${Math.round((criteria.marketplace_fee_rate || 0) * 100)}% estimado`}
          />
          <Metric label="Baixas de estoque" value={metrics.stock_decrement_events} />
          <Metric
            label="Margem estimada"
            value={metrics.estimated_margin != null ? brl(metrics.estimated_margin) : '—'}
            hint="Se custo disponível / config"
          />
        </div>
      </div>

      {metrics.top_products?.length ? (
        <SkipCard className="shadow-subtle">
          <SkipCardContent className="p-4">
            <p className="text-sm font-bold m-0 mb-2">Produtos mais vendidos</p>
            <ul className="space-y-1.5 list-none p-0 m-0 text-sm">
              {metrics.top_products.map((p) => (
                <li key={p.name} className="flex justify-between gap-2">
                  <span className="truncate">
                    {p.name}{' '}
                    <span className="text-muted-foreground">×{p.quantity}</span>
                  </span>
                  <span className="font-semibold shrink-0">{brl(p.revenue)}</span>
                </li>
              ))}
            </ul>
          </SkipCardContent>
        </SkipCard>
      ) : null}

      <SkipCard className="shadow-subtle">
        <SkipCardContent className="p-4">
          <p className="text-sm font-bold m-0 mb-2">Uso de funcionalidades</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(metrics.features_used || {}).map(([key, on]) => (
              <span
                key={key}
                className={`text-[10px] font-semibold rounded-full px-2 py-1 border ${
                  on
                    ? 'bg-primary/10 text-primary border-primary/30'
                    : 'bg-muted text-muted-foreground border-border'
                }`}
              >
                {key}
              </span>
            ))}
          </div>
        </SkipCardContent>
      </SkipCard>
    </div>
  );
}
