import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { validatePasswordStrength } from '../lib/securityPolicy';
import { FINMEMORY_CREDENTIAL_ERROR } from '../lib/finmemoryLoginErrorCodes';
import { messageForCredentialLogin } from '../lib/loginErrorMessages';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [showForgot, setShowForgot] = useState(false);
  const [show2fa, setShow2fa] = useState(false);

  const callbackUrl = typeof router.query?.callbackUrl === 'string' ? router.query.callbackUrl : '/mapa';
  const resetToken = typeof router.query?.resetToken === 'string' ? router.query.resetToken : '';
  const resetEmail = typeof router.query?.email === 'string' ? router.query.email : '';
  const verified = router.query?.verified === '1';
  const resetOk = router.query?.resetOk === '1';

  const doLogin = async () => {
    setBusy(true);
    setMsg('');
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
    router.push(res.url || callbackUrl);
  };

  const doSignup = async () => {
    setBusy(true);
    setMsg('');
    const resp = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password,
        name: name.trim(),
      }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      setBusy(false);
      setMsg(data.error || 'Erro ao criar conta.');
      return;
    }
    setBusy(false);
    setMsg('Conta criada. Confira seu email para confirmar e depois entrar.');
  };

  const doResendVerification = async () => {
    setBusy(true);
    setMsg('');
    await fetch('/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
    setBusy(false);
    setMsg('Se o email existir, enviamos um novo link de confirmação.');
  };

  const doRequestReset = async () => {
    setBusy(true);
    setMsg('');
    await fetch('/api/auth/request-password-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
    setBusy(false);
    setMsg('Se o email existir, enviamos um link de redefinição.');
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
        <form onSubmit={onSubmit} className="bg-white rounded-[20px] p-8 w-full max-w-md shadow-card-lovable">
          <h1 className="text-2xl font-bold text-[#333] text-center mb-4">FinMemory</h1>
          {verified ? <p className="text-sm text-green-700 mb-3">Email confirmado com sucesso. Agora é só entrar.</p> : null}
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
                className="w-full mb-2 rounded-lg border border-gray-300 px-3 py-2"
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
              }}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold ${mode === 'signup' ? 'bg-[#2ECC49] text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              Criar conta
            </button>
          </div>

          {mode === 'signup' ? (
            <input
              type="text"
              placeholder="Nome (opcional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full mb-3 rounded-lg border border-gray-300 px-3 py-2"
            />
          ) : null}
          <input
            type="email"
            placeholder="Seu email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full mb-3 rounded-lg border border-gray-300 px-3 py-2"
          />
          <input
            type="password"
            placeholder="Sua senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full mb-3 rounded-lg border border-gray-300 px-3 py-2"
          />
          {mode === 'login' ? (
            <div className="mb-3">
              {!show2fa ? (
                <button
                  type="button"
                  onClick={() => {
                    setShow2fa(true);
                    setMsg('');
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
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-center tracking-widest font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setShow2fa(false);
                      setOtp('');
                      setMsg('');
                    }}
                    className="mt-2 text-xs text-gray-500 underline"
                  >
                    Ocultar 2FA
                  </button>
                </div>
              )}
            </div>
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
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={doResendVerification} className="rounded-lg py-2 text-xs border border-gray-300">
              Reenviar confirmação
            </button>
            <button type="button" onClick={() => setShowForgot((v) => !v)} className="rounded-lg py-2 text-xs border border-gray-300">
              Esqueci a senha
            </button>
          </div>
          {showForgot ? (
            <button type="button" onClick={doRequestReset} className="mt-2 w-full rounded-lg py-2 text-xs bg-gray-100">
              Enviar link de redefinição
            </button>
          ) : null}

          <p className="text-xs text-center mt-4">
            <Link href="/" className="text-[#2ECC49] underline">Voltar</Link>
          </p>
        </form>
      </div>
    </>
  );
}
