import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft, Settings, LogOut, FileText, Shield, Smartphone, Instagram, Trash2 } from 'lucide-react';
import { BottomNav } from '../components/BottomNav';
import ProximityAlertsSettings from '../components/ProximityAlertsSettings';
import PlanGuard from '../components/PlanGuard';
import { usePWAInstallUIOptional } from '../components/PWAInstallProvider';
import { PLAN_LABELS } from '../lib/planAccess';
import { BRAND } from '../lib/brandTokens';

const ConnectBank = dynamic(() => import('../components/ConnectBank'), { ssr: false });
const UpgradePlus = dynamic(() => import('../components/UpgradeButton'), { ssr: false });

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pwaUi = usePWAInstallUIOptional();
  const userId =
    session?.user?.supabaseId ||
    (typeof window !== 'undefined' ? localStorage.getItem('user_id') : null);
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [totpSecret, setTotpSecret] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [totpMsg, setTotpMsg] = useState('');
  const [xpStats, setXpStats] = useState(null);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteAccountBusy, setDeleteAccountBusy] = useState(false);
  const [deleteAccountErr, setDeleteAccountErr] = useState('');
  const [subscriptionStatus, setSubscriptionStatus] = useState({
    loading: false,
    plano: 'free',
    plano_ativo: false,
    stripe_subscription_status: '',
    next_billing_at: null,
    cancel_at_period_end: false,
    error: '',
  });
  const [billingPortalBusy, setBillingPortalBusy] = useState(false);

  useEffect(() => {
    if (status !== 'authenticated') return undefined;
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch('/api/map/gamification-me');
        const data = await resp.json().catch(() => ({}));
        if (cancelled) return;
        if (resp.ok) {
          setXpStats({
            xp_points: Number(data.xp_points) || 0,
            contributions_count: Number(data.contributions_count) || 0,
            level: Number(data.level) || 1,
          });
        } else {
          setXpStats({ xp_points: 0, contributions_count: 0, level: 1 });
        }
      } catch {
        if (!cancelled) setXpStats({ xp_points: 0, contributions_count: 0, level: 1 });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;
    async function loadSubscriptionStatus() {
      setSubscriptionStatus((prev) => ({ ...prev, loading: true, error: '' }));
      try {
        const res = await fetch('/api/stripe/subscription-status');
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setSubscriptionStatus((prev) => ({
            ...prev,
            loading: false,
            error: data?.error || 'Falha ao carregar assinatura',
          }));
          return;
        }
        setSubscriptionStatus({
          loading: false,
          plano: String(data.plano || 'free').toLowerCase(),
          plano_ativo: Boolean(data.plano_ativo),
          stripe_subscription_status: String(data.stripe_subscription_status || ''),
          next_billing_at: data.next_billing_at || null,
          cancel_at_period_end: Boolean(data.cancel_at_period_end),
          error: '',
        });
      } catch (e) {
        if (!cancelled) {
          setSubscriptionStatus((prev) => ({
            ...prev,
            loading: false,
            error: e?.message || 'Erro de rede ao carregar assinatura',
          }));
        }
      }
    }
    void loadSubscriptionStatus();
    return () => {
      cancelled = true;
    };
  }, [status]);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/dashboard');
  }, [status, router]);

  useEffect(() => {
    const load = async () => {
      if (status !== 'authenticated') return;
      const resp = await fetch('/api/auth/2fa/status');
      const data = await resp.json().catch(() => ({}));
      setTwoFaEnabled(Boolean(data.enabled));
    };
    load();
  }, [status]);

  const handleDisconnect = async () => {
    if (confirm('Deseja realmente sair? Suas transações não serão perdidas.')) {
      if (typeof window !== 'undefined') localStorage.removeItem('user_id');
      await signOut({ callbackUrl: '/dashboard' });
    }
  };

  const handleStart2fa = async () => {
    setTotpMsg('');
    const resp = await fetch('/api/auth/2fa/setup', { method: 'POST' });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      setTotpMsg(data.error || 'Falha ao iniciar 2FA');
      return;
    }
    setTotpSecret(data.secret || '');
    setTotpMsg('2FA iniciado. Adicione o segredo no seu app autenticador e confirme o código.');
  };

  const handleEnable2fa = async () => {
    setTotpMsg('');
    const resp = await fetch('/api/auth/2fa/enable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: totpCode }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      setTotpMsg(data.error || 'Código inválido');
      return;
    }
    setTwoFaEnabled(true);
    setTotpSecret('');
    setTotpCode('');
    setTotpMsg('2FA ativado com sucesso.');
  };

  const handleDisable2fa = async () => {
    setTotpMsg('');
    const resp = await fetch('/api/auth/2fa/disable', { method: 'POST' });
    if (resp.ok) {
      setTwoFaEnabled(false);
      setTotpSecret('');
      setTotpCode('');
      setTotpMsg('2FA desativado.');
      return;
    }
    setTotpMsg('Falha ao desativar 2FA.');
  };

  const handleConfirmDeleteAccount = async () => {
    setDeleteAccountErr('');
    setDeleteAccountBusy(true);
    try {
      const r = await fetch('/api/account/delete', { method: 'DELETE', credentials: 'same-origin' });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setDeleteAccountErr(data.error || 'Não foi possível excluir a conta.');
        return;
      }
      setShowDeleteAccountModal(false);
      if (typeof window !== 'undefined') localStorage.removeItem('user_id');
      await signOut({ callbackUrl: '/', redirect: true });
    } catch (e) {
      setDeleteAccountErr(e?.message || 'Erro de rede.');
    } finally {
      setDeleteAccountBusy(false);
    }
  };

  const handleOpenBillingPortal = async () => {
    setBillingPortalBusy(true);
    try {
      const res = await fetch('/api/stripe/create-billing-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || 'Não foi possível abrir o portal de cobrança');
      }
      window.location.assign(data.url);
    } catch (e) {
      alert(e?.message || 'Não foi possível abrir o portal Stripe');
    } finally {
      setBillingPortalBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="max-w-md mx-auto px-5 py-6 pb-24">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 text-sm mb-6">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
            <Settings className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Ajustes</h1>
            <p className="text-sm text-gray-500">Privacidade e conta</p>
          </div>
        </div>

        {status === 'authenticated' && userId ? (
          <PlanGuard
            feature="radar"
            title="Radar de Ofertas — Plano Plus"
            body="Receba alertas quando estiver perto de lojas com promoções da sua lista. Disponível no plano Plus."
            className="mb-4"
          >
            <ProximityAlertsSettings userId={userId} />
          </PlanGuard>
        ) : null}

        {status === 'authenticated' && xpStats ? (
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
        ) : null}

        {status === 'authenticated' && session?.user ? (
          <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900">Planos FinMemory</h2>
            <p className="mt-1 text-sm text-gray-500">
              Assinatura no Stripe — Plus, Pro ou Família. Os preços vêm do Stripe Checkout.
            </p>
            <button
              type="button"
              onClick={() => router.push('/planos')}
              className="mt-4 w-full rounded-xl bg-[#2ECC49] py-3 px-4 text-center text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#25b340] hover:shadow-md active:scale-[0.98] motion-reduce:active:scale-100"
            >
              Ver planos disponíveis
            </button>
            <div className="mt-4 flex flex-col gap-2">
              <UpgradePlus
                plan="plus"
                userId={session.user.supabaseId}
                userEmail={session.user.email}
                className="w-full rounded-lg bg-gray-900 py-2 text-sm font-semibold text-white"
              >
                Assinar Plus — R$ 9,90/mês
              </UpgradePlus>
              <UpgradePlus
                plan="pro"
                userId={session.user.supabaseId}
                userEmail={session.user.email}
                className="w-full rounded-lg border border-gray-900 bg-white py-2 text-sm font-semibold text-gray-900"
              >
                Assinar Pro — R$ 19,90/mês
              </UpgradePlus>
              <UpgradePlus
                plan="familia"
                userId={session.user.supabaseId}
                userEmail={session.user.email}
                className="w-full rounded-lg py-2 text-sm font-semibold text-white"
                style={{ backgroundColor: BRAND.primary }}
              >
                Assinar Família — R$ 29,90/mês
              </UpgradePlus>
            </div>
          </div>
        ) : null}

        {status === 'authenticated' && session?.user ? (
          <div
            className="mb-6 overflow-hidden rounded-2xl p-4 shadow-sm"
            style={{ border: `1px solid ${BRAND.primarySoftBorder}`, background: BRAND.primarySoftBg }}
          >
            <h2 className="text-base font-semibold text-gray-900">Centro de Assinatura</h2>
            <p className="mt-1 text-sm text-gray-600">Status do pagamento e ativação do seu plano em tempo real.</p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-xl bg-white px-3 py-2" style={{ border: `1px solid ${BRAND.primarySoftBorder}` }}>
                <p className="text-[11px] text-gray-500">Plano atual</p>
                <p className="text-sm font-semibold text-gray-900">
                  {PLAN_LABELS[String(subscriptionStatus.plano || 'free')] || 'Grátis'}
                </p>
              </div>
              <div className="rounded-xl bg-white px-3 py-2" style={{ border: `1px solid ${BRAND.primarySoftBorder}` }}>
                <p className="text-[11px] text-gray-500">Situação</p>
                <p className="text-sm font-semibold" style={{ color: subscriptionStatus.plano_ativo ? BRAND.primaryText : '#111827' }}>
                  {subscriptionStatus.plano_ativo ? 'Ativo' : 'Inativo'}
                  {subscriptionStatus.cancel_at_period_end ? ' (encerrando no fim do ciclo)' : ''}
                </p>
              </div>
              <div
                className="rounded-xl bg-white px-3 py-2 sm:col-span-2"
                style={{ border: `1px solid ${BRAND.primarySoftBorder}` }}
              >
                <p className="text-[11px] text-gray-500">Próxima renovação</p>
                <p className="text-sm font-semibold text-gray-900">
                  {subscriptionStatus.next_billing_at
                    ? new Date(subscriptionStatus.next_billing_at).toLocaleDateString('pt-BR')
                    : 'Sem cobrança futura no momento'}
                </p>
              </div>
            </div>
            {subscriptionStatus.error ? (
              <p className="mt-2 text-xs text-red-600">{subscriptionStatus.error}</p>
            ) : null}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => router.replace(router.asPath)}
                disabled={subscriptionStatus.loading}
                className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                {subscriptionStatus.loading ? 'Atualizando…' : 'Atualizar status'}
              </button>
              <button
                type="button"
                onClick={handleOpenBillingPortal}
                disabled={billingPortalBusy}
                className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: BRAND.primary }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = BRAND.primaryHover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = BRAND.primary;
                }}
              >
                {billingPortalBusy ? 'Abrindo…' : 'Gerenciar assinatura'}
              </button>
            </div>
          </div>
        ) : null}

        {pwaUi?.installEntryVisible ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6">
            <button
              type="button"
              onClick={() => pwaUi.openInstallAssistant()}
              className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors text-left text-gray-900"
            >
              <Smartphone className="h-5 w-5 text-[#2ECC49]" />
              <div>
                <span className="font-medium block">Instalar app na tela inicial</span>
                <span className="text-xs text-gray-500">Atalho como um app — abre em um toque</span>
              </div>
            </button>
          </div>
        ) : null}

        {status === 'authenticated' && session?.user ? (
          <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900">Conta</h2>
            <p className="mt-1 text-sm text-gray-500">
              Excluir a conta remove os seus dados do FinMemory, conforme a Política de Privacidade.
            </p>
            <button
              type="button"
              onClick={() => {
                setDeleteAccountErr('');
                setShowDeleteAccountModal(true);
              }}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100"
            >
              <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
              Excluir conta
            </button>
          </div>
        ) : null}

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <Link href="/privacidade" className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors border-b border-gray-200 text-gray-900">
            <Shield className="h-5 w-5 text-gray-500" />
            <span className="font-medium">Política de Privacidade</span>
          </Link>
          <Link href="/termos" className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors border-b border-gray-200 text-gray-900">
            <FileText className="h-5 w-5 text-gray-500" />
            <span className="font-medium">Termos de Uso</span>
          </Link>
          {status === 'authenticated' && session && (
            <button
              type="button"
              onClick={handleDisconnect}
              className="w-full flex items-center gap-4 p-4 hover:bg-red-50 transition-colors text-left text-red-600 font-semibold"
            >
              <LogOut className="h-5 w-5" />
              <span>Sair da conta</span>
            </button>
          )}
        </div>

        {session?.user && (
          <p className="text-center text-gray-500 text-sm mt-6">
            Conectado como {session.user.email}
          </p>
        )}

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mt-6">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-900">Segurança da conta</h2>
            <p className="text-sm text-gray-500 mt-1">Ative 2FA (TOTP) para proteger contas sensíveis.</p>
          </div>
          <div className="p-4 border-b border-gray-200">
            <p className="text-sm mb-3">Status 2FA: <span className="font-semibold">{twoFaEnabled ? 'Ativo' : 'Inativo'}</span></p>
            {!twoFaEnabled ? (
              <div className="space-y-2">
                <button type="button" onClick={handleStart2fa} className="w-full rounded-lg py-2 border border-gray-300 text-sm">Iniciar configuração 2FA</button>
                {totpSecret ? (
                  <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
                    <p className="text-xs text-gray-600">Segredo TOTP (copie para Google Authenticator/Authy):</p>
                    <p className="font-mono text-xs break-all mt-1">{totpSecret}</p>
                    <input
                      type="text"
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value)}
                      placeholder="Código de 6 dígitos"
                      className="w-full mt-2 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                    <button type="button" onClick={handleEnable2fa} className="w-full mt-2 rounded-lg py-2 bg-[#2ECC49] text-white text-sm font-semibold">Confirmar e ativar</button>
                  </div>
                ) : null}
              </div>
            ) : (
              <button type="button" onClick={handleDisable2fa} className="w-full rounded-lg py-2 border border-red-200 text-red-600 text-sm">Desativar 2FA</button>
            )}
            {totpMsg ? <p className="text-xs text-gray-600 mt-2">{totpMsg}</p> : null}
          </div>
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-900">Open Finance (Pluggy)</h2>
            <p className="text-sm text-gray-500 mt-1">
              Conecte seu banco pelo Open Finance (PicPay, Nubank, etc.) para importar movimentações no dashboard.
              Depois de conectar, as transações sincronizam automaticamente.
            </p>
          </div>
          <div className="p-4">
            {status === 'authenticated' ? (
              <PlanGuard
                feature="open_finance"
                title="Open Finance — Plano Pro"
                body="Conecte seus bancos e importe movimentações automaticamente. Disponível no plano Pro."
              >
                <ConnectBank
                  onSuccess={() => {
                    router.push('/dashboard');
                  }}
                  onError={(e) => {
                    const msg = e?.message || 'Falha ao conectar banco.';
                    if (typeof window !== 'undefined') alert(msg);
                  }}
                />
              </PlanGuard>
            ) : (
              <p className="text-sm text-gray-500">Faça login para conectar seu banco.</p>
            )}
          </div>
        </div>
      </div>

      {showDeleteAccountModal ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleteAccountBusy) {
              setShowDeleteAccountModal(false);
              setDeleteAccountErr('');
            }
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-xl">
            <h2 id="delete-account-title" className="text-lg font-semibold text-gray-900">
              Excluir conta
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-gray-600">
              Tem certeza? Esta ação é irreversível. Todos os seus dados serão excluídos em até 30 dias.
            </p>
            {deleteAccountErr ? (
              <p className="mt-3 text-sm text-red-600" role="alert">
                {deleteAccountErr}
              </p>
            ) : null}
            <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse sm:justify-end">
              <button
                type="button"
                disabled={deleteAccountBusy}
                onClick={handleConfirmDeleteAccount}
                className="w-full rounded-xl bg-red-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-60 sm:w-auto sm:min-w-[11rem]"
              >
                {deleteAccountBusy ? 'A excluir…' : 'Excluir permanentemente'}
              </button>
              <button
                type="button"
                disabled={deleteAccountBusy}
                onClick={() => {
                  setShowDeleteAccountModal(false);
                  setDeleteAccountErr('');
                }}
                className="w-full rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-800 transition hover:bg-gray-50 disabled:opacity-60 sm:w-auto sm:min-w-[7rem]"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <BottomNav />
    </div>
  );
}
