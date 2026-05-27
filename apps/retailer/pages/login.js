import { useState, useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { validatePasswordStrength } from '../lib/securityPolicy';
import { FINMEMORY_CREDENTIAL_ERROR } from '../lib/finmemoryLoginErrorCodes';
import { messageForCredentialLogin } from '../lib/loginErrorMessages';
import { capturePosthog, identifyPosthog } from '../lib/posthogClient';
import { SocialLoginButtons } from '../components/auth/SocialLoginButtons';

export default function LoginPage({ socialProviders = [] }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [showForgot, setShowForgot] = useState(false);
  const [show2fa, setShow2fa] = useState(false);
  /** Esqueci o e-mail: telefone OU CPF */
  const [showForgotEmail, setShowForgotEmail] = useState(false);
  const [recoveryPhone, setRecoveryPhone] = useState('');
  const [recoveryDoc, setRecoveryDoc] = useState('');
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoveryHint, setRecoveryHint] = useState(null); // { maskedEmail, found }
  const [infoMsg, setInfoMsg] = useState('');

  const callbackUrl = typeof router.query?.callbackUrl === 'string' ? router.query.callbackUrl : '/parceiros/painel';

  /** Conta autenticada: ir ao destino */
  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.supabaseId) return;
    const dest = callbackUrl.startsWith('/') ? callbackUrl : '/dashboard';
    router.replace(dest);
  }, [status, session?.user?.supabaseId, callbackUrl, router]);

  const resetToken = typeof router.query?.resetToken === 'string' ? router.query.resetToken : '';
  const resetEmail = typeof router.query?.email === 'string' ? router.query.email : '';
  const verified = router.query?.verified === '1';
  const resetOk = router.query?.resetOk === '1';

  const doLogin = async () => {
    setBusy(true);
    setMsg('');
    setInfoMsg('');
    const res = await signIn('credentials', {
      email: email.trim().toLowerCase(),
      password,
      otp: show2fa ? otp.trim() : '',
      redirect: false,
      callbackUrl,
    });
    setBusy(false);
    if (!res || res.error) {
      let code = res?.error ?? null;
      if (!code && typeof res?.url === 'string') {
        try {
          code = new URL(res.url).searchParams.get('error');
        } catch (_) {
          /* ignore */
        }
      }
      const revealOtpForMessage =
        show2fa || code === FINMEMORY_CREDENTIAL_ERROR.REQUIRES_OTP;
      if (code === FINMEMORY_CREDENTIAL_ERROR.REQUIRES_OTP) {
        setShow2fa(true);
      }
      setMsg(messageForCredentialLogin(code, { otpFieldVisible: revealOtpForMessage }));
      return;
    }
    capturePosthog('user_logged_in', {
      method: 'credentials',
      has_otp: Boolean(show2fa && otp.trim()),
    });
    router.push(res.url || callbackUrl);
  };

  const doSignup = async () => {
    setBusy(true);
    setMsg('');
    setInfoMsg('');
    const emailNorm = email.trim().toLowerCase();
    const resp = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: emailNorm,
        password,
      }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      setBusy(false);
      setMsg(data.error || 'Erro ao criar conta.');
      return;
    }
    if (data.userId) {
      identifyPosthog(String(data.userId), {
        email: emailNorm,
        signup_method: 'email',
        email_verified: true,
      });
    }
    capturePosthog('user_signed_up', {
      method: 'email',
      ...(data.userId ? { user_id: String(data.userId) } : {}),
    });

    const loginRes = await signIn('credentials', {
      email: emailNorm,
      password,
      otp: '',
      redirect: false,
      callbackUrl,
    });

    setBusy(false);
    if (!loginRes || loginRes.error) {
      let code = loginRes?.error ?? null;
      setMsg(code ? messageForCredentialLogin(code, {}) : 'Conta criada. Tente entrar com email e senha.');
      return;
    }
    const dest =
      typeof loginRes.url === 'string' && loginRes.url.startsWith('/') ? loginRes.url : callbackUrl.startsWith('/') ? callbackUrl : '/dashboard';
    router.replace(dest);
  };

  const doResendVerification = async () => {
    setBusy(true);
    setMsg('');
    setInfoMsg('');
    await fetch('/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
    setBusy(false);
    setInfoMsg('Se o email existir, enviamos um novo link de confirmação.');
  };

  const doRequestReset = async () => {
    setBusy(true);
    setMsg('');
    setInfoMsg('');
    await fetch('/api/auth/request-password-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
    setBusy(false);
    setInfoMsg('Se o email existir, enviamos um link de redefinição.');
  };

  const lookupRecoveryHint = async (requestPasswordReset = false) => {
    setRecoveryBusy(true);
    setRecoveryHint(null);
    setMsg('');
    setInfoMsg('');
    try {
      const res = await fetch('/api/auth/recovery-email-hint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: recoveryPhone.trim() || undefined,
          document: recoveryDoc.trim() || undefined,
          requestPasswordReset,
        }),
      });
      const data = await res.json().catch(() => ({}));
      setRecoveryBusy(false);
      if (!res.ok) {
        setMsg(data.error || 'Não foi possível consultar.');
        return;
      }
      setRecoveryHint({
        found: Boolean(data.found),
        maskedEmail: data.maskedEmail || '',
        resetSent: Boolean(data.resetEmailSent),
      });
      if (data.resetEmailSent && data.message) {
        setInfoMsg(data.message);
      } else if (data.found && data.message) {
        setInfoMsg(data.message);
      } else if (!data.found) {
        setInfoMsg(data.message || 'Consulta concluída. Se não encontramos, confira o número ou CPF.');
      }
    } catch (e) {
      setRecoveryBusy(false);
      setMsg(e.message || 'Erro de rede.');
    }
  };

  const doResetPassword = async () => {
    if (!resetToken || !resetEmail) return;
    const check = validatePasswordStrength(password);
    if (!check.ok) {
      setMsg(check.message);
      return;
    }
    setBusy(true);
    setMsg('');
    setInfoMsg('');
    const resp = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: resetEmail,
        token: resetToken,
        password,
      }),
    });
    const data = await resp.json().catch(() => ({}));
    setBusy(false);
    if (!resp.ok) {
      setMsg(data.error || 'Falha ao redefinir senha.');
      return;
    }
    setPassword('');
    await router.replace({ pathname: '/login', query: { resetOk: '1' } });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setMsg('Preencha email e senha.');
      return;
    }
    if (mode === 'signup') {
      const check = validatePasswordStrength(password);
      if (!check.ok) {
        setMsg(check.message);
        return;
      }
      await doSignup();
      return;
    }
    await doLogin();
  };

  return (
    <>
      <Head>
        <title>FinMemory - Entrar</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center bg-gradient-primary p-5">
        <form onSubmit={onSubmit} className="finmemory-public-light-panel bg-white rounded-[20px] p-8 w-full max-w-md shadow-card-lovable">
          <h1 className="text-2xl font-bold text-[#333] text-center mb-4">FinMemory</h1>
          {verified ? (
            <p className="text-sm text-green-700 mb-3">
              Email confirmado com sucesso. Agora é só entrar.
            </p>
          ) : null}
          {resetOk ? <p className="text-sm text-green-700 mb-3">Senha redefinida. Faça login com a nova senha.</p> : null}
          {resetToken && resetEmail ? (
            <div className="mb-4 rounded-lg border border-gray-200 p-3 bg-gray-50">
              <p className="text-sm font-semibold mb-2">Redefinir senha</p>
              <p className="text-xs text-gray-600 mb-2">Email: {resetEmail}</p>
              <input
                type="password"
                placeholder="Nova senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full mb-2 rounded-lg border border-gray-300 px-3 py-2.5 text-base text-[#111827] placeholder:text-gray-500"
              />
              <button
                type="button"
                disabled={busy}
                onClick={doResetPassword}
                className="w-full rounded-lg py-2 bg-[#2ECC49] text-white font-semibold disabled:opacity-60"
              >
                {busy ? 'Aguarde...' : 'Salvar nova senha'}
              </button>
            </div>
          ) : null}
          <div className="mb-4 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setShow2fa(false);
                setOtp('');
                setMsg('');
                setInfoMsg('');
              }}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold ${mode === 'login' ? 'bg-[#2ECC49] text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setShow2fa(false);
                setOtp('');
                setMsg('');
                setInfoMsg('');
              }}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold ${mode === 'signup' ? 'bg-[#2ECC49] text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              Criar conta
            </button>
          </div>

          <p className="text-[11px] text-center text-gray-600 mb-3 leading-relaxed">
            {mode === 'signup'
              ? 'Cadastro rápido: Google, Facebook ou email e senha. Você entra já e completa dados de segurança no onboarding.'
              : 'Entre com Google, Facebook ou email e senha.'}
          </p>

          {!resetToken ? (
            <SocialLoginButtons providers={socialProviders} callbackUrl={callbackUrl} disabled={busy} />
          ) : null}

          <input
            type="email"
            placeholder="Seu email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
            className="w-full mb-3 rounded-lg border border-gray-300 px-3 py-2.5 text-base text-[#111827] placeholder:text-gray-500"
          />
          <input
            type="password"
            placeholder="Sua senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            className="w-full mb-3 rounded-lg border border-gray-300 px-3 py-2.5 text-base text-[#111827] placeholder:text-gray-500"
          />

          {mode === 'login' ? (
            <div className="mb-3">
              {!show2fa ? (
                <button
                  type="button"
                  onClick={() => {
                    setShow2fa(true);
                    setMsg('');
                setInfoMsg('');
                  }}
                  className="text-xs text-[#2ECC49] underline underline-offset-2"
                >
                  Conta com 2FA? Toque para informar o codigo
                </button>
              ) : (
                <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-3">
                  <p className="text-xs text-gray-600 mb-2">Codigo do app autenticador (6 digitos)</p>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-center text-base tracking-widest font-mono text-[#111827] placeholder:text-gray-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setShow2fa(false);
                      setOtp('');
                      setMsg('');
                setInfoMsg('');
                    }}
                    className="mt-2 text-xs text-gray-500 underline"
                  >
                    Ocultar 2FA
                  </button>
                </div>
              )}
            </div>
          ) : null}

          {infoMsg ? (
            <p
              className={`text-sm mb-3 whitespace-pre-wrap ${infoMsg.includes('Se houver') || infoMsg.includes('confira o número') ? 'text-gray-600' : 'text-green-700'}`}
            >
              {infoMsg}
            </p>
          ) : null}
          {msg ? <p className="text-sm text-red-600 mb-3 whitespace-pre-wrap">{msg}</p> : null}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg py-3 bg-[#2ECC49] text-white font-semibold disabled:opacity-60"
          >
            {busy ? 'Aguarde...' : mode === 'signup' ? 'Criar conta e entrar' : 'Entrar'}
          </button>

          <p className="mt-3 text-xs text-center text-gray-500">
            Ao continuar, você concorda com nossos{' '}
            <Link href="/termos" className="text-[#2ECC49] underline">
              Termos de Serviço
            </Link>{' '}
            e{' '}
            <Link href="/privacidade" className="text-[#2ECC49] underline">
              Política de Privacidade
            </Link>
            .
          </p>

          <div className="mt-3 flex flex-wrap gap-2 justify-center">
            <button type="button" onClick={doResendVerification} className="rounded-lg py-2 px-2 text-xs border border-gray-300">
              Reenviar confirmação de email
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForgot((v) => !v);
                setShowForgotEmail(false);
              }}
              className="rounded-lg py-2 px-2 text-xs border border-gray-300"
            >
              Esqueci a senha
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForgotEmail((v) => !v);
                setShowForgot(false);
                setRecoveryHint(null);
              }}
              className="rounded-lg py-2 px-2 text-xs border border-gray-300"
            >
              Esqueci meu email
            </button>
          </div>

          {showForgot ? (
            <button type="button" onClick={doRequestReset} className="mt-2 w-full rounded-lg py-2 text-xs bg-gray-100">
              Enviar link de redefinição para o email acima
            </button>
          ) : null}

          {showForgotEmail ? (
            <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3 text-left">
              <p className="text-sm font-semibold text-gray-900 m-0">Recuperar com celular ou CPF</p>
              <p className="text-xs text-gray-600 m-0">
                Digite um dos dois cadastrados no app. Mostramos seu email mascarado; você pode também pedir o link para nova senha.
              </p>
              <input
                type="tel"
                placeholder="Celular (com DDD)"
                value={recoveryPhone}
                onChange={(e) => setRecoveryPhone(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-[#111827]"
              />
              <input
                type="text"
                placeholder="Ou CPF"
                value={recoveryDoc}
                onChange={(e) => setRecoveryDoc(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-[#111827]"
              />
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={recoveryBusy}
                  onClick={() => lookupRecoveryHint(false)}
                  className="rounded-lg py-2 bg-[#2ECC49] text-white text-xs font-semibold disabled:opacity-60"
                >
                  {recoveryBusy ? 'Consultando…' : 'Mostrar email mascarado'}
                </button>
                {recoveryHint?.found ? (
                  <p className="text-sm text-green-800 m-0 text-center font-mono">{recoveryHint.maskedEmail}</p>
                ) : null}
                {recoveryHint?.found ? (
                  <button
                    type="button"
                    disabled={recoveryBusy}
                    onClick={() => lookupRecoveryHint(true)}
                    className="rounded-lg py-2 border border-[#2ECC49] text-[#2ECC49] text-xs font-semibold"
                  >
                    Enviar link de nova senha
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          <p className="text-xs text-center mt-4">
            <Link href="/" className="text-[#2ECC49] underline">
              Voltar
            </Link>
          </p>
        </form>
      </div>
    </>
  );
}

export async function getServerSideProps() {
  const { getEnabledSocialProviders } = await import('../lib/auth/getSocialProviders');
  return {
    props: {
      socialProviders: getEnabledSocialProviders(),
    },
  };
}
