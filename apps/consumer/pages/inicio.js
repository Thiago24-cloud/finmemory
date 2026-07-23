import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { getServerSession } from 'next-auth/next';
import { useSession } from 'next-auth/react';
import { ArrowLeft, Check, Loader2, MapPin, Store, Wallet } from 'lucide-react';
import { authOptions } from './api/auth/[...nextauth]';
import { canAccessForSession } from '../lib/access-server';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { fetchUserPlanPreference, homePathFromPreference } from '../lib/planPreference';
import {
  CONSUMER_PLANS,
  MERCHANT_PLANS,
  CONSUMER_TRIAL_DAYS,
} from '../lib/productPlansCatalog';

export async function getServerSideProps(ctx) {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!(await canAccessForSession(session))) {
    return { redirect: { destination: '/login?callbackUrl=/inicio', permanent: false } };
  }

  const force = ctx.query?.change === '1' || ctx.query?.trial === 'expired';
  if (!force && session?.user?.supabaseId) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const prefs = await fetchUserPlanPreference(supabase, session.user.supabaseId);
      const home = homePathFromPreference(prefs || {});
      if (home && !home.startsWith('/inicio')) {
        return { redirect: { destination: home, permanent: false } };
      }
    }
  }

  return {
    props: {
      trialExpired: ctx.query?.trial === 'expired',
    },
  };
}

function PlanCard({ plan, selected, onSelect, icon: Icon }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(plan.id)}
      className={`text-left rounded-2xl border p-4 transition w-full ${
        selected
          ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200'
          : 'border-border bg-card hover:border-emerald-300'
      }`}
    >
      <div className="flex items-start gap-3">
        {Icon ? (
          <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-bold text-sm m-0">{plan.label}</p>
            <p className="text-xs font-semibold text-muted-foreground m-0 shrink-0">
              {plan.priceLabel}
              {plan.priceNote ? ` ${plan.priceNote}` : ''}
            </p>
          </div>
          <p className="text-xs text-muted-foreground m-0 mt-1">{plan.landingBlurb}</p>
          <ul className="mt-2 space-y-1 list-none p-0 m-0">
            {(plan.highlights || []).slice(0, 4).map((h) => (
              <li key={h} className="flex gap-1.5 text-[11px] text-foreground/80">
                <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </button>
  );
}

export default function InicioPlanHub({ trialExpired }) {
  const router = useRouter();
  const { update } = useSession();
  const [audience, setAudience] = useState('consumer');
  const [planId, setPlanId] = useState(audience === 'consumer' ? 'free' : 'estoque_margem');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const plans =
    audience === 'consumer' ? Object.values(CONSUMER_PLANS) : Object.values(MERCHANT_PLANS);

  const pickAudience = (next) => {
    setAudience(next);
    setPlanId(next === 'consumer' ? 'free' : 'estoque_margem');
    setError('');
  };

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/account/select-trial-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audience, plan: planId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Falha ao salvar plano.');
        return;
      }
      try {
        await update({
          preferred_audience: data.preferred_audience,
          preferred_plan: data.preferred_plan,
          plan_trial_ends_at: data.plan_trial_ends_at,
        });
      } catch {
        /* session update optional */
      }

      const home = data.home || '/dashboard';
      if (/^https?:\/\//i.test(home)) {
        window.location.href = home;
        return;
      }
      await router.replace(home);
    } catch {
      setError('Erro de rede.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Head>
        <title>Escolha seu plano · FinMemory</title>
      </Head>
      <div className="min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur px-4 py-3 flex items-center gap-3">
          <Link href="/settings" className="p-2 rounded-xl hover:bg-muted" aria-label="Voltar">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-base font-bold m-0">Como você quer usar o FinMemory?</h1>
            <p className="text-[11px] text-muted-foreground m-0">
              Escolha o plano da landing para testar ({CONSUMER_TRIAL_DAYS} dias). Sem pagamento por
              enquanto.
            </p>
          </div>
        </header>

        <main className="max-w-lg mx-auto px-4 py-5 space-y-5 pb-28">
          {trialExpired ? (
            <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 m-0">
              Seu período de teste acabou. Escolha de novo o plano que quer experimentar.
            </p>
          ) : null}

          {error ? (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 m-0">
              {error}
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => pickAudience('consumer')}
              className={`rounded-2xl border p-3 text-left ${
                audience === 'consumer'
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-border bg-card'
              }`}
            >
              <MapPin className="h-5 w-5 text-emerald-600 mb-1" />
              <p className="text-sm font-bold m-0">Consumidor</p>
              <p className="text-[11px] text-muted-foreground m-0">B2C · mapa e finanças</p>
            </button>
            <button
              type="button"
              onClick={() => pickAudience('merchant')}
              className={`rounded-2xl border p-3 text-left ${
                audience === 'merchant'
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-border bg-card'
              }`}
            >
              <Store className="h-5 w-5 text-emerald-600 mb-1" />
              <p className="text-sm font-bold m-0">Comerciante</p>
              <p className="text-[11px] text-muted-foreground m-0">B2B · estoque e loja</p>
            </button>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              {audience === 'consumer' ? 'Planos consumidor (landing)' : 'Planos lojista (landing)'}
            </p>
            <div className="space-y-3">
              {plans.map((p) => (
                <PlanCard
                  key={p.id}
                  plan={p}
                  selected={planId === p.id}
                  onSelect={setPlanId}
                  icon={
                    audience === 'consumer'
                      ? p.id === 'free'
                        ? MapPin
                        : Wallet
                      : Store
                  }
                />
              ))}
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground m-0">
            {audience === 'consumer' && planId === 'free'
              ? 'Entrada: mapa de preços (Caça-Preço).'
              : audience === 'consumer'
                ? 'Entrada: dashboard financeiro — o mapa continua disponível.'
                : 'Entrada: painel do lojista no app Parceiros, com as abas do plano escolhido.'}
          </p>
        </main>

        <div className="fixed bottom-0 inset-x-0 border-t border-border bg-background p-4">
          <button
            type="button"
            disabled={busy || !planId}
            onClick={() => void confirm()}
            className="w-full max-w-lg mx-auto flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground font-bold py-3 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Testar este plano
          </button>
        </div>
      </div>
    </>
  );
}
