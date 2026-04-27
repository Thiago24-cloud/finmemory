import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft, Check, Lock, X } from 'lucide-react';
import { BottomNav } from '../components/BottomNav';
import { PLAN_LABELS } from '../lib/planAccess';
import { BRAND } from '../lib/brandTokens';

const UpgradeBtn = dynamic(() => import('../components/UpgradeButton'), { ssr: false });

/** Base comum: hover “acende” azul em todos os planos (não só no Pro). */
const cardBase =
  'rounded-2xl bg-white p-5 flex flex-col border border-gray-200 shadow-sm ' +
  'transition-all duration-300 ease-out ' +
  'hover:scale-[1.02] hover:shadow-xl hover:ring-2 hover:ring-blue-400/65 hover:border-blue-200 ' +
  'motion-reduce:transition-none motion-reduce:hover:scale-100';

/** Pro: destaque suave em repouso; no hover o azul intensifica como os outros. */
const cardPro =
  `${cardBase} relative border-blue-200 ring-1 ring-blue-300/50 ` +
  'hover:ring-blue-500 hover:border-blue-400 hover:shadow-blue-500/15';

function Li({ children }) {
  return (
    <li className="flex gap-2 text-sm text-gray-700">
      <Check className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" strokeWidth={2.5} />
      <span>{children}</span>
    </li>
  );
}

function LiOff({ children }) {
  return (
    <li className="flex gap-2 text-sm text-gray-400">
      <span className="w-4 shrink-0 text-center mt-0.5">—</span>
      <span>{children}</span>
    </li>
  );
}

/** Linha bloqueada: cadeado + hover + clique abre upsell (micro-conversão). */
function LiLocked({ children, onUnlock }) {
  return (
    <li>
      <button
        type="button"
        onClick={onUnlock}
        className="group flex w-full gap-2 rounded-lg py-1.5 pr-1 text-left text-sm text-gray-400 transition-colors hover:bg-blue-50/80 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        <span className="w-4 shrink-0 text-center mt-0.5">—</span>
        <span className="min-w-0 flex-1 opacity-80 group-hover:opacity-100">{children}</span>
        <Lock
          className="h-4 w-4 shrink-0 text-gray-300 transition-colors group-hover:text-blue-500 mt-0.5"
          strokeWidth={2}
          aria-hidden
        />
      </button>
    </li>
  );
}

const UPSELL_COPY = {
  radar: {
    title: 'Ative o radar de ofertas',
    body:
      'Quando estiver a caminho, o FinMemory pode avisar se há promoções perto de si com itens da sua lista — ' +
      'foco em ofertas já publicadas no mapa, não em “queda de preço” futura.',
    plan: 'pro',
    cta: 'Desbloquear no Pro',
  },
  openFinance: {
    title: 'Open Finance',
    body:
      'Ligue os seus bancos com segurança e deixe de lançar tudo à mão. Disponível a partir do plano Pro.',
    plan: 'pro',
    cta: 'Assinar Pro',
  },
};

export default function PlanosPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [upsell, setUpsell] = useState(null);

  const closeUpsell = useCallback(() => setUpsell(null), []);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login?callbackUrl=/planos');
    }
  }, [status, router]);

  useEffect(() => {
    if (!upsell) return;
    const onKey = (e) => e.key === 'Escape' && closeUpsell();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [upsell, closeUpsell]);

  const authed = status === 'authenticated' && session?.user;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-24">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 text-sm mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Ajustes
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Planos FinMemory</h1>
          <p className="mt-1 text-gray-600 text-sm max-w-2xl">
            Compare o que inclui cada nível. Passe o rato pelos cartões para destacar. A assinatura abre no Stripe
            Checkout (pagamento seguro).
          </p>
          {authed ? (
            <p
              className="mt-2 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
              style={{ border: `1px solid ${BRAND.primarySoftBorder}`, background: BRAND.primarySoftBg, color: BRAND.primaryText }}
            >
              Plano ativo: {PLAN_LABELS[String(session?.user?.plano || 'free').toLowerCase()] || 'Grátis'}
            </p>
          ) : null}
        </div>

        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 mb-6">
          Se o checkout não abrir, valide o ambiente: execute <code className="text-xs">npm run validate-env</code> e
          confirme <code className="text-xs">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code>,{' '}
          <code className="text-xs">STRIPE_SECRET_KEY</code>, <code className="text-xs">STRIPE_WEBHOOK_SECRET</code> e
          os Price IDs do Stripe.
        </p>

        {/* Modal upsell (cadeado no plano Grátis) */}
        {upsell ? (
          <div
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-4 sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="planos-upsell-title"
            onClick={(e) => e.target === e.currentTarget && closeUpsell()}
          >
            <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl">
              <div className="flex items-start justify-between gap-3">
                <h2 id="planos-upsell-title" className="text-lg font-bold text-gray-900">
                  {upsell.title}
                </h2>
                <button
                  type="button"
                  onClick={closeUpsell}
                  className="rounded-full p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-gray-600">{upsell.body}</p>
              <p className="mt-3 text-xs text-gray-500">
                Cancele quando quiser. Assinatura mensal via Stripe.
              </p>
              <div className="mt-5 flex flex-col gap-2">
                {authed ? (
                  <UpgradeBtn
                    plan={upsell.plan}
                    userId={session.user.supabaseId}
                    userEmail={session.user.email}
                    className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-blue-700"
                  >
                    {upsell.cta}
                  </UpgradeBtn>
                ) : status === 'authenticated' ? (
                  <p className="text-center text-sm text-amber-800">
                    Configure o Stripe para concluir a assinatura aqui.
                  </p>
                ) : (
                  <p className="text-center text-sm text-gray-500">A carregar…</p>
                )}
                <button
                  type="button"
                  onClick={closeUpsell}
                  className="w-full rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Agora não
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Free */}
          <div className={cardBase}>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Grátis</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              R$ 0<span className="text-sm font-normal text-gray-500"> / sempre</span>
            </p>
            <ul className="mt-4 space-y-1 flex-1">
              <Li>Mapa de preços completo</Li>
              <Li>3 scans NFC-e por mês</Li>
              <Li>Histórico de 30 dias</Li>
              <Li>Carrinho de compras</Li>
              <LiLocked onUnlock={() => setUpsell(UPSELL_COPY.radar)}>Radar de ofertas (perto de si)</LiLocked>
              <LiLocked onUnlock={() => setUpsell(UPSELL_COPY.openFinance)}>Open Finance</LiLocked>
            </ul>
            <button
              type="button"
              disabled
              className="mt-6 w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 text-sm font-semibold text-gray-500 cursor-not-allowed"
            >
              Plano atual
            </button>
          </div>

          {/* Plus */}
          <div className={cardBase}>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Plus</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              R$ 9,90<span className="text-sm font-normal text-gray-500"> / mês</span>
            </p>
            <ul className="mt-4 space-y-2 flex-1">
              <Li>Tudo do plano Grátis</Li>
              <Li>NFC-e ilimitado</Li>
              <Li>Radar de ofertas (perto de si)</Li>
              <Li>Histórico completo</Li>
              <Li>Categorias ilimitadas</Li>
              <LiOff>Open Finance</LiOff>
            </ul>
            {authed ? (
              <UpgradeBtn
                plan="plus"
                userId={session.user.supabaseId}
                userEmail={session.user.email}
                className="mt-6 w-full rounded-lg bg-gradient-to-r from-gray-900 to-gray-800 py-2.5 text-sm font-semibold text-white shadow-md transition hover:from-gray-800 hover:to-gray-900"
              >
                Assinar Plus
              </UpgradeBtn>
            ) : (
              <p className="mt-6 text-center text-sm text-gray-500">A carregar…</p>
            )}
          </div>

          {/* Pro — “Mais popular” + mesma linguagem de hover que os outros */}
          <div className={cardPro}>
            <span className="absolute -top-2.5 left-1/2 z-[1] -translate-x-1/2 rounded-full bg-blue-600 px-3 py-0.5 text-[10px] font-bold uppercase text-white shadow">
              Mais popular
            </span>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 mt-2">Pro</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              R$ 19,90<span className="text-sm font-normal text-gray-500"> / mês</span>
            </p>
            <ul className="mt-4 space-y-2 flex-1">
              <Li>Tudo do Plus</Li>
              <Li>Open Finance</Li>
              <Li>Scanner EAN</Li>
              <Li>Histórico de preços</Li>
              <Li>Relatórios avançados</Li>
              <Li>Suporte prioritário</Li>
            </ul>
            {authed ? (
              <UpgradeBtn
                plan="pro"
                userId={session.user.supabaseId}
                userEmail={session.user.email}
                className="mt-6 w-full rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 py-2.5 text-sm font-semibold text-white shadow-md transition hover:from-blue-500 hover:to-blue-600"
              >
                Assinar Pro
              </UpgradeBtn>
            ) : (
              <p className="mt-6 text-center text-sm text-gray-500">A carregar…</p>
            )}
          </div>

          {/* Família */}
          <div className={cardBase}>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Família</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              R$ 29,90<span className="text-sm font-normal text-gray-500"> / mês</span>
            </p>
            <ul className="mt-4 space-y-2 flex-1">
              <Li>Tudo do Pro</Li>
              <Li>Até 5 membros</Li>
              <Li>Gastos compartilhados</Li>
              <Li>Metas em família</Li>
              <Li>Painel familiar</Li>
              <Li>1 conta por membro</Li>
            </ul>
            {authed ? (
              <UpgradeBtn
                plan="familia"
                userId={session.user.supabaseId}
                userEmail={session.user.email}
                className="mt-6 w-full rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-700 py-2.5 text-sm font-semibold text-white shadow-md transition hover:from-emerald-500 hover:to-emerald-600"
              >
                Assinar Família
              </UpgradeBtn>
            ) : (
              <p className="mt-6 text-center text-sm text-gray-500">A carregar…</p>
            )}
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
