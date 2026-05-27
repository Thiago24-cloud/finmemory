import React, { memo } from 'react';
import { Instagram } from 'lucide-react';
import PlanGuard from '../PlanGuard';
import ProximityAlertsSettings from '../ProximityAlertsSettings';
import { PLAN_LABELS } from '../../lib/planAccess';
import { APP_DARK_UI, BRAND } from '../../lib/brandTokens';
import { cn } from '../../lib/utils';

const pulse =
  'animate-pulse rounded-lg bg-gray-200/90 dark:bg-zinc-700/80';

/** Alturas alinhadas ao conteúdo real (web): radar, XP, planos, centro de assinatura. */
export const SettingsAccountTopSkeleton = memo(function SettingsAccountTopSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div
        className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80"
        style={{ minHeight: 178 }}
      >
        <div className={cn('h-4 w-44', pulse)} />
        <div className={cn('mt-3 h-3 w-full', pulse)} />
        <div className={cn('mt-2 h-3 w-[92%]', pulse)} />
        <div className={cn('mt-2 h-3 w-[70%]', pulse)} />
      </div>

      <div
        className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-zinc-100 shadow-sm"
        style={{ minHeight: 220 }}
      >
        <div className={cn('h-3 w-40 bg-zinc-700/80 dark:bg-zinc-600/90', pulse)} />
        <div className={cn('mt-4 h-9 w-48 bg-zinc-700/80 dark:bg-zinc-600/90', pulse)} />
        <div className={cn('mt-3 h-3 w-64 bg-zinc-700/80 dark:bg-zinc-600/90', pulse)} />
        <div className={cn('mt-4 h-1.5 w-full rounded-full bg-zinc-800 dark:bg-zinc-700', pulse)} />
        <div className={cn('mt-3 h-3 w-52 bg-zinc-700/80 dark:bg-zinc-600/90', pulse)} />
      </div>

      <div
        className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80"
        style={{ minHeight: 340 }}
      >
        <div className={cn('h-5 w-48', pulse)} />
        <div className={cn('mt-2 h-3 w-full', pulse)} />
        <div className={cn('mt-2 h-3 w-[88%]', pulse)} />
        <div className={cn('mt-6 h-11 w-full rounded-xl', pulse)} />
        <div className={cn('mt-4 h-10 w-full rounded-lg', pulse)} />
        <div className={cn('mt-2 h-10 w-full rounded-lg', pulse)} />
        <div className={cn('mt-2 h-10 w-full rounded-lg', pulse)} />
      </div>

      <div
        className="overflow-hidden rounded-2xl p-4 shadow-sm"
        style={{
          minHeight: 268,
          border: `1px solid ${BRAND.primarySoftBorder}`,
          background: BRAND.primarySoftBg,
        }}
      >
        <div className={cn('h-5 w-56 bg-emerald-100/50', pulse)} />
        <div className={cn('mt-2 h-3 w-full max-w-md bg-emerald-100/40', pulse)} />
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="h-[52px] rounded-xl bg-white/90" style={{ border: `1px solid ${BRAND.primarySoftBorder}` }}>
            <div className={cn('m-2 h-2.5 w-16', pulse)} />
            <div className={cn('mx-2 mb-2 h-4 w-24', pulse)} />
          </div>
          <div className="h-[52px] rounded-xl bg-white/90" style={{ border: `1px solid ${BRAND.primarySoftBorder}` }}>
            <div className={cn('m-2 h-2.5 w-14', pulse)} />
            <div className={cn('mx-2 mb-2 h-4 w-20', pulse)} />
          </div>
          <div
            className="h-[52px] rounded-xl bg-white/90 sm:col-span-2"
            style={{ border: `1px solid ${BRAND.primarySoftBorder}` }}
          >
            <div className={cn('m-2 h-2.5 w-28', pulse)} />
            <div className={cn('mx-2 mb-2 h-4 w-40', pulse)} />
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <div className={cn('h-10 flex-1 rounded-xl', pulse)} />
          <div className={cn('h-10 flex-1 rounded-xl', pulse)} />
        </div>
      </div>
    </div>
  );
});

export const SettingsRadarSection = memo(function SettingsRadarSection({ userId }) {
  if (!userId) return null;
  return (
    <PlanGuard
      feature="radar"
      title="Radar de Ofertas — Plano Pro"
      body="Receba alertas quando estiver perto de lojas com promoções da sua lista. Disponível no plano Pro."
      className="mb-4"
    >
      <ProximityAlertsSettings userId={userId} />
    </PlanGuard>
  );
});

export const SettingsXpImpactCard = memo(function SettingsXpImpactCard({ xpStats }) {
  if (!xpStats) return null;
  return (
    <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-zinc-100 shadow-sm">
      <p className="mb-1 text-xs text-zinc-500">Seu impacto na comunidade</p>
      <p className="text-2xl font-bold text-zinc-100">
        {xpStats.xp_points} <span className="text-orange-400">XP</span>
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        Nível {xpStats.level} · {xpStats.contributions_count} confirmações no mapa
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-700"
          style={{ width: `${xpStats.xp_points % 100}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-zinc-600">
        Faltam {Math.max(0, 100 - (xpStats.xp_points % 100))} XP para o nível {xpStats.level + 1}
      </p>
      <a
        href="https://instagram.com/finmemory.oficial"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center gap-2 text-xs text-zinc-400 transition-colors hover:text-orange-400"
      >
        <Instagram className="h-3.5 w-3.5" />
        Ver novidades no Instagram
      </a>
    </div>
  );
});

export const SettingsSubscriptionCenterCard = memo(function SettingsSubscriptionCenterCard({
  subscriptionStatus,
  onRefresh,
  onOpenBillingPortal,
  billingPortalBusy,
}) {
  return (
    <div className={cn(APP_DARK_UI.card, 'mb-6 overflow-hidden')}>
      <h2 className={APP_DARK_UI.sectionTitle}>Centro de Assinatura</h2>
      <p className={APP_DARK_UI.sectionLead}>Status do pagamento e ativação do seu plano em tempo real.</p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className={APP_DARK_UI.statBox}>
          <p className={APP_DARK_UI.label}>Plano atual</p>
          <p className={cn(APP_DARK_UI.value, 'mt-0.5')}>
            {PLAN_LABELS[String(subscriptionStatus.plano || 'free')] || 'Grátis'}
          </p>
        </div>
        <div className={APP_DARK_UI.statBox}>
          <p className={APP_DARK_UI.label}>Situação</p>
          <p className={cn(APP_DARK_UI.value, 'mt-0.5', subscriptionStatus.plano_ativo && 'text-[#2ECC49]')}>
            {subscriptionStatus.plano_ativo ? 'Ativo' : 'Inativo'}
            {subscriptionStatus.cancel_at_period_end ? ' (encerrando no fim do ciclo)' : ''}
          </p>
        </div>
        <div className={cn(APP_DARK_UI.statBox, 'sm:col-span-2')}>
          <p className={APP_DARK_UI.label}>Próxima renovação</p>
          <p className={cn(APP_DARK_UI.value, 'mt-0.5')}>
            {subscriptionStatus.next_billing_at
              ? new Date(subscriptionStatus.next_billing_at).toLocaleDateString('pt-BR')
              : 'Sem cobrança futura no momento'}
          </p>
        </div>
      </div>
      {subscriptionStatus.error ? (
        <p className="mt-2 text-xs text-red-400">{subscriptionStatus.error}</p>
      ) : null}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onRefresh}
          disabled={subscriptionStatus.loading}
          className={APP_DARK_UI.btnGhost}
        >
          {subscriptionStatus.loading ? 'Atualizando…' : 'Atualizar status'}
        </button>
        {subscriptionStatus.plano_ativo ? (
          <button
            type="button"
            onClick={onOpenBillingPortal}
            disabled={billingPortalBusy}
            className={APP_DARK_UI.btnPrimary}
          >
            {billingPortalBusy ? 'Abrindo…' : 'Gerenciar assinatura'}
          </button>
        ) : (
          <a href="/planos" className={APP_DARK_UI.btnPrimary}>
            Ver planos
          </a>
        )}
      </div>
    </div>
  );
});
