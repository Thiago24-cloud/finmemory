import { useCallback, useEffect, useState, useRef, memo } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft, Settings, LogOut, FileText, Shield, Smartphone, Trash2 } from 'lucide-react';
import PlanGuard from '../components/PlanGuard';
import {
  SettingsAccountTopSkeleton,
  SettingsRadarSection,
  SettingsXpImpactCard,
  SettingsSubscriptionCenterCard,
} from '../components/settings/SettingsAccountPanels';
import { usePWAInstallUIOptional } from '../components/PWAInstallProvider';
import { APP_DARK_UI, BRAND } from '../lib/brandTokens';
import { readSettingsAccountCache, writeSettingsAccountCache } from '../lib/settingsAccountCache';

const OpenFinanceConnectPanel = dynamic(() => import('../components/OpenFinanceConnectPanel'), {
  ssr: false,
});
const UpgradePlan = dynamic(() => import('../components/UpgradeButton'), { ssr: false });

const MIN_ACCOUNT_READY_MS = 160;
const ACCOUNT_FETCH_TIMEOUT_MS = 10000;
const SKELETON_SAFETY_TIMEOUT_MS = 12000;

async function fetchWithTimeout(input, init = {}, ms = ACCOUNT_FETCH_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(tid);
  }
}

const SettingsPlanosBlock = memo(function SettingsPlanosBlock({ supabaseId, userEmail }) {
  if (!supabaseId || !userEmail) return null;
  return (
    <div className={APP_DARK_UI.card + ' mb-6 overflow-hidden'}>
      <h2 className={APP_DARK_UI.sectionTitle}>Planos FinMemory</h2>
      <p className={APP_DARK_UI.sectionLead}>
        Assinatura no Stripe — Pro, Família ou Enterprise. Os preços vêm do Stripe Checkout.
      </p>
      <Link
        href="/planos"
        prefetch={false}
        scroll={false}
        className="mt-4 block w-full rounded-xl bg-[#2ECC49] py-3 px-4 text-center text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#25b340] hover:shadow-md active:scale-[0.98] motion-reduce:active:scale-100"
      >
        Ver planos disponíveis
      </Link>
      <div className="mt-4 flex flex-col gap-2">
        <UpgradePlan
          plan="pro"
          userId={supabaseId}
          userEmail={userEmail}
          className="w-full rounded-lg bg-[#2ECC49] py-2 text-sm font-semibold text-white hover:bg-[#25b340]"
        >
          Assinar Pro — R$ 24,90/mês
        </UpgradePlan>
        <UpgradePlan
          plan="familia"
          userId={supabaseId}
          userEmail={userEmail}
          className="w-full rounded-lg border border-[#2ECC49]/50 bg-secondary/40 py-2 text-sm font-semibold text-[#2ECC49] hover:bg-secondary/60"
        >
          Assinar Família — R$ 99,90/mês
        </UpgradePlan>
        <UpgradePlan
          plan="enterprise"
          userId={supabaseId}
          userEmail={userEmail}
          className="w-full rounded-lg bg-[#2ECC49] py-2 text-sm font-semibold text-white hover:bg-[#25b340]"
        >
          Assinar Enterprise — R$ 17,90/mês
        </UpgradePlan>
      </div>
    </div>
  );
});

export default function SettingsPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const pwaUi = usePWAInstallUIOptional();
  const updateRef = useRef(update);
  updateRef.current = update;
  const userId =
    session?.user?.supabaseId ||
    (typeof window !== 'undefined' ? localStorage.getItem('user_id') : null);
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [totpSecret, setTotpSecret] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [totpMsg, setTotpMsg] = useState('');
  const [xpStats, setXpStats] = useState(null);
  const [accountUiReady, setAccountUiReady] = useState(false);
  const [accountDiag, setAccountDiag] = useState(null);
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

  const handleRefreshSubscription = useCallback(async () => {
    setSubscriptionStatus((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      await fetchWithTimeout('/api/stripe/sync-plan-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      await (updateRef.current?.() ?? Promise.resolve()).catch(() => {});
      const res = await fetchWithTimeout('/api/stripe/subscription-status');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubscriptionStatus((prev) => ({
          ...prev,
          loading: false,
          error: data?.error || 'Falha ao carregar assinatura',
        }));
        return;
      }
      const nextSub = {
        loading: false,
        plano: String(data.plano || 'free').toLowerCase(),
        plano_ativo: Boolean(data.plano_ativo),
        stripe_subscription_status: String(data.stripe_subscription_status || ''),
        next_billing_at: data.next_billing_at || null,
        cancel_at_period_end: Boolean(data.cancel_at_period_end),
        error: '',
      };
      setSubscriptionStatus(nextSub);
      const key = session?.user?.supabaseId || session?.user?.email || '';
      setXpStats((currentXp) => {
        if (currentXp && key) writeSettingsAccountCache(key, currentXp, nextSub);
        return currentXp;
      });
    } catch (e) {
      setSubscriptionStatus((prev) => ({
        ...prev,
        loading: false,
        error: e?.message || 'Erro de rede ao carregar assinatura',
      }));
    }
  }, [session?.user?.supabaseId, session?.user?.email]);

  /** XP + assinatura: cache imediato; fetch em paralelo; sync Stripe em background (evita skeleton longo). */
  useEffect(() => {
    if (status === 'loading') return undefined;

    if (status !== 'authenticated' || !session?.user) {
      setAccountUiReady(false);
      setXpStats(null);
      setSubscriptionStatus({
        loading: false,
        plano: 'free',
        plano_ativo: false,
        stripe_subscription_status: '',
        next_billing_at: null,
        cancel_at_period_end: false,
        error: '',
      });
      return undefined;
    }

    const userKey = session.user.supabaseId || session.user.email || '';
    const cached = readSettingsAccountCache(userKey);
    if (cached) {
      setXpStats(cached.xp);
      setSubscriptionStatus(cached.sub);
      setAccountUiReady(true);
    } else {
      setAccountUiReady(false);
    }

    let cancelled = false;
    const t0 = Date.now();

    const safetyTimer = setTimeout(() => {
      if (!cancelled) setAccountUiReady(true);
    }, SKELETON_SAFETY_TIMEOUT_MS);

    const diagTimer = setTimeout(() => {
      if (!cancelled && !accountUiReady) {
        setAccountDiag({
          status,
          email: session?.user?.email || '(sem email)',
          supabaseId: session?.user?.supabaseId || '(ausente — causa provável do skeleton infinito)',
          plano: session?.user?.plano || '(ausente)',
          ts: new Date().toISOString(),
        });
      }
    }, 5000);

    (async () => {
      try {
        const [gWrap, subRes] = await Promise.all([
          fetchWithTimeout('/api/map/gamification-me').then(async (resp) => {
            const data = await resp.json().catch(() => ({}));
            return { ok: resp.ok, data };
          }),
          fetchWithTimeout('/api/stripe/subscription-status'),
        ]);
        const subData = await subRes.json().catch(() => ({}));
        if (cancelled) return;

        const xp =
          gWrap.ok && gWrap.data
            ? {
                xp_points: Number(gWrap.data.xp_points) || 0,
                contributions_count: Number(gWrap.data.contributions_count) || 0,
                level: Number(gWrap.data.level) || 1,
              }
            : { xp_points: 0, contributions_count: 0, level: 1 };

        let nextSub = {
          loading: false,
          plano: 'free',
          plano_ativo: false,
          stripe_subscription_status: '',
          next_billing_at: null,
          cancel_at_period_end: false,
          error: '',
        };
        if (!subRes.ok) {
          nextSub = {
            ...nextSub,
            error: subData?.error || 'Falha ao carregar assinatura',
          };
        } else {
          nextSub = {
            loading: false,
            plano: String(subData.plano || 'free').toLowerCase(),
            plano_ativo: Boolean(subData.plano_ativo),
            stripe_subscription_status: String(subData.stripe_subscription_status || ''),
            next_billing_at: subData.next_billing_at || null,
            cancel_at_period_end: Boolean(subData.cancel_at_period_end),
            error: '',
          };
        }

        writeSettingsAccountCache(userKey, xp, nextSub);

        const elapsed = Date.now() - t0;
        await new Promise((r) => setTimeout(r, Math.max(0, MIN_ACCOUNT_READY_MS - elapsed)));
        if (cancelled) return;

        setXpStats(xp);
        setSubscriptionStatus(nextSub);
        setAccountUiReady(true);
      } catch {
        if (cancelled) return;
        if (cached) return;
        const xpFallback = { xp_points: 0, contributions_count: 0, level: 1 };
        const elapsed = Date.now() - t0;
        await new Promise((r) => setTimeout(r, Math.max(0, MIN_ACCOUNT_READY_MS - elapsed)));
        if (cancelled) return;
        setXpStats(xpFallback);
        setSubscriptionStatus({
          loading: false,
          plano: 'free',
          plano_ativo: false,
          stripe_subscription_status: '',
          next_billing_at: null,
          cancel_at_period_end: false,
          error: 'Erro ao carregar dados da conta',
        });
        setAccountUiReady(true);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
      clearTimeout(diagTimer);
    };
  }, [status, session?.user?.email, session?.user?.supabaseId]);

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

  const handleOpenBillingPortal = useCallback(async () => {
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
  }, []);

  return (
    <div className={APP_DARK_UI.page}>
      <div className="max-w-md mx-auto px-5 py-6 pb-[calc(6.25rem+env(safe-area-inset-bottom))]">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-foreground/70 hover:text-[#2ECC49] text-sm mb-6">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
            <Settings className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-[#2ECC49]">Ajustes</h1>
            <p className="text-sm text-foreground/70">Privacidade e conta</p>
          </div>
        </div>

        {status === 'loading' || (status === 'authenticated' && !accountUiReady) ? (
          <SettingsAccountTopSkeleton />
        ) : null}

        {accountDiag && !accountUiReady && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-mono text-red-800">
            <p className="font-bold mb-1">⏱ Diagnóstico (5s sem carregar)</p>
            <p>status: <b>{accountDiag.status}</b></p>
            <p>email: {accountDiag.email}</p>
            <p>supabaseId: {accountDiag.supabaseId}</p>
            <p>plano (sessão): {accountDiag.plano}</p>
            <p className="mt-1 text-red-600">Se supabaseId aparecer &quot;ausente&quot;, faça logout e login novamente.</p>
          </div>
        )}

        {status === 'authenticated' && accountUiReady && session?.user ? (
          <>
            <SettingsRadarSection userId={userId} />
            <SettingsXpImpactCard xpStats={xpStats} />
            <SettingsPlanosBlock supabaseId={session.user.supabaseId} userEmail={session.user.email} />
            <SettingsSubscriptionCenterCard
              subscriptionStatus={subscriptionStatus}
              onRefresh={handleRefreshSubscription}
              onOpenBillingPortal={handleOpenBillingPortal}
              billingPortalBusy={billingPortalBusy}
            />
          </>
        ) : null}

        {pwaUi?.installEntryVisible ? (
          <div className={APP_DARK_UI.card + ' overflow-hidden mb-6'}>
            <button
              type="button"
              onClick={() => pwaUi.openInstallAssistant()}
              className="w-full flex items-center gap-4 p-0 hover:opacity-90 transition-opacity text-left"
            >
              <Smartphone className="h-5 w-5 text-[#2ECC49]" />
              <div>
                <span className="font-medium block text-[#2ECC49]">Instalar app na tela inicial</span>
                <span className="text-xs text-foreground/70">Atalho como um app — abre em um toque</span>
              </div>
            </button>
          </div>
        ) : null}

        {status === 'authenticated' && session?.user && accountUiReady ? (
          <div className={APP_DARK_UI.card + ' mb-6 overflow-hidden'}>
            <h2 className={APP_DARK_UI.sectionTitle}>Conta</h2>
            <p className={APP_DARK_UI.sectionLead}>
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

        <div className="rounded-2xl border border-zinc-700 shadow-sm overflow-hidden">
          <Link
            href="/mapa?landing=1"
            className="flex items-center gap-4 p-4 bg-white hover:bg-gray-50 transition-colors border-b border-zinc-700 text-gray-900"
          >
            <span className="h-5 w-5 flex items-center justify-center text-base">🗺️</span>
            <span className="font-medium">Como quer começar? (guia do mapa)</span>
          </Link>
          <Link
            href="/privacidade"
            className="flex items-center gap-4 p-4 bg-zinc-900 hover:bg-zinc-800 transition-colors border-b border-zinc-800 text-white"
          >
            <Shield className="h-5 w-5 text-zinc-300" />
            <span className="font-medium text-white">Política de Privacidade</span>
          </Link>
          <Link
            href="/termos"
            className="flex items-center gap-4 p-4 bg-zinc-900 hover:bg-zinc-800 transition-colors border-b border-zinc-800 text-white"
          >
            <FileText className="h-5 w-5 text-zinc-300" />
            <span className="font-medium text-white">Termos de Uso</span>
          </Link>
          {status === 'authenticated' && session && (
            <button
              type="button"
              onClick={handleDisconnect}
              className="w-full flex items-center gap-4 p-4 bg-zinc-900 hover:bg-red-950/40 transition-colors text-left text-red-400 font-semibold"
            >
              <LogOut className="h-5 w-5" />
              <span>Sair da conta</span>
            </button>
          )}
        </div>

        {session?.user && (
          <p className="text-center text-foreground/60 text-sm mt-6">
            Conectado como {session.user.email}
          </p>
        )}

        <div className={APP_DARK_UI.card + ' overflow-hidden mt-6'}>
          <div className="p-0 pb-4 border-b border-border">
            <h2 className={APP_DARK_UI.sectionTitle}>Segurança da conta</h2>
            <p className={APP_DARK_UI.sectionLead}>Ative 2FA (TOTP) para proteger contas sensíveis.</p>
          </div>
          <div className="py-4 border-b border-border">
            <p className={APP_DARK_UI.body + ' mb-3'}>
              Status 2FA:{' '}
              <span className="font-semibold text-[#2ECC49]">{twoFaEnabled ? 'Ativo' : 'Inativo'}</span>
            </p>
            {!twoFaEnabled ? (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleStart2fa}
                  className={APP_DARK_UI.btnGhost + ' w-full'}
                >
                  Iniciar configuração 2FA
                </button>
                {totpSecret ? (
                  <div className="rounded-lg border border-border bg-secondary/50 p-3">
                    <p className="text-xs text-[#2ECC49]">Segredo TOTP (copie para Google Authenticator/Authy):</p>
                    <p className="font-mono text-xs break-all mt-1 text-foreground">{totpSecret}</p>
                    <input
                      type="text"
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value)}
                      placeholder="Código de 6 dígitos"
                      className="w-full mt-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                    />
                    <button
                      type="button"
                      onClick={handleEnable2fa}
                      className="w-full mt-2 rounded-lg py-2 bg-[#2ECC49] text-white text-sm font-semibold hover:bg-[#25b340]"
                    >
                      Confirmar e ativar
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <button
                type="button"
                onClick={handleDisable2fa}
                className="w-full rounded-lg py-2 border border-red-500/40 text-red-400 text-sm hover:bg-red-950/30"
              >
                Desativar 2FA
              </button>
            )}
            {totpMsg ? <p className="text-xs text-foreground/70 mt-2">{totpMsg}</p> : null}
          </div>
          <div className="py-4 border-b border-border">
            <h2 className={APP_DARK_UI.sectionTitle}>Open Finance (Pluggy)</h2>
            <p className={APP_DARK_UI.sectionLead}>
              1 banco grátis para sempre no plano Grátis. Bancos adicionais exigem Pro, Família ou Enterprise.
              PicPay, Nubank, etc. — movimentações no dashboard após conectar.
            </p>
          </div>
          <div className="pt-4">
            {status === 'authenticated' ? (
              <OpenFinanceConnectPanel
                onSuccess={() => {
                  router.push('/dashboard');
                }}
                onError={(e) => {
                  const msg = e?.message || 'Falha ao conectar banco.';
                  if (typeof window !== 'undefined') alert(msg);
                }}
              />
            ) : (
              <p className={APP_DARK_UI.body}>Faça login para conectar seu banco.</p>
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
    </div>
  );
}
