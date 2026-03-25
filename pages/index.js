import { useSession, signIn, getCsrfToken } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';

const SESSION_LOADING_TIMEOUT_MS = 5000;

/** Base pública (verificação Google exige link explícito para política na home; URL absoluta evita falha de crawlers) */
const SITE_ORIGIN = (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://finmemory.com.br')
  .trim()
  .replace(/\/$/, '');

/** POST em formulário para garantir envio do cookie CSRF (evita signin?csrf=true no Cloud Run) */
async function signInWithGoogleForm(callbackUrl = '/mapa') {
  const csrfToken = await getCsrfToken();
  if (!csrfToken) {
    signIn('google', { callbackUrl });
    return;
  }
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = '/api/auth/signin/google';
  const csrf = document.createElement('input');
  csrf.name = 'csrfToken';
  csrf.value = csrfToken;
  csrf.type = 'hidden';
  form.appendChild(csrf);
  const cb = document.createElement('input');
  cb.name = 'callbackUrl';
  cb.value = callbackUrl;
  cb.type = 'hidden';
  form.appendChild(cb);
  document.body.appendChild(form);
  form.submit();
}

/**
 * Página inicial: logo Fin Memory + login com Google.
 * Sem cadastro por e-mail; entra direto com Google.
 */
export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { msg } = router.query;
  const isNotRegistered = msg === 'nao-cadastrado';
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);

  // Evita ficar preso em "Carregando..." se /api/auth/session demorar ou falhar (ex.: adapter DB)
  useEffect(() => {
    if (status !== 'loading') return;
    const t = setTimeout(() => setLoadingTimedOut(true), SESSION_LOADING_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [status]);
  useEffect(() => {
    if (status !== 'loading') setLoadingTimedOut(false);
  }, [status]);

  // Só redireciona para o mapa se estiver autenticado e NÃO veio de "acesso negado"
  // (evita loop: mapa redireciona para /?msg=nao-cadastrado -> index redireciona para mapa -> repetir)
  useEffect(() => {
    if (status === 'authenticated' && router.query.msg !== 'nao-cadastrado') {
      router.push('/mapa');
    }
  }, [status, router, router.query.msg]);

  const handleSignIn = () => {
    signInWithGoogleForm('/mapa');
  };

  const showLoading = status === 'loading' && !loadingTimedOut;

  /** Rodapé verde: sempre no HTML inicial (estado “Carregando”) */
  const legalFooter = (
    <nav
      className="mt-6 w-full max-w-[600px] mx-auto text-center text-sm text-white/95"
      aria-label="Informações legais"
    >
      <a
        href={`${SITE_ORIGIN}/privacidade`}
        className="font-medium underline underline-offset-2 hover:text-white"
      >
        Política de Privacidade
      </a>
      <span className="mx-2 text-white/50" aria-hidden>
        ·
      </span>
      <a
        href={`${SITE_ORIGIN}/termos`}
        className="font-medium underline underline-offset-2 hover:text-white"
      >
        Termos de Serviço
      </a>
    </nav>
  );

  /** Também dentro do card branco — alguns verificadores só analisam o “miolo” da página */
  const legalLinksInCard = (
    <p className="text-sm text-[#666] mt-6 text-center leading-relaxed">
      <a
        href={`${SITE_ORIGIN}/privacidade`}
        className="text-[#2ECC49] font-semibold underline underline-offset-2 hover:text-[#25a83c]"
      >
        Política de Privacidade
      </a>
      <span className="mx-2 text-[#ccc]" aria-hidden>
        ·
      </span>
      <a
        href={`${SITE_ORIGIN}/termos`}
        className="text-[#2ECC49] font-semibold underline underline-offset-2 hover:text-[#25a83c]"
      >
        Termos de Serviço
      </a>
    </p>
  );

  return (
    <>
      <Head>
        <title>
          {showLoading ? 'Fin Memory – Carregando' : 'Fin Memory – Assistente financeiro inteligente'}
        </title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="min-h-screen flex flex-col items-center justify-center p-5 bg-gradient-primary font-sans">
        {showLoading ? (
          <div className="bg-white rounded-[20px] p-10 text-center shadow-card-lovable max-w-[600px] w-full">
            <div className="text-4xl mb-4 animate-pulse">⏳</div>
            <p className="text-[#666]">Carregando...</p>
            {legalLinksInCard}
          </div>
        ) : (
        <div className="bg-white rounded-[20px] p-8 md:p-10 text-center shadow-[0_20px_60px_rgba(0,0,0,0.3)] max-w-[600px] w-full">
          {/* Logo FinMemory */}
          <div className="mb-8 flex flex-col items-center justify-center">
            <Image
              src="/logo.png"
              alt="FinMemory"
              width={160}
              height={160}
              priority
              className="object-contain"
            />
            <h1 className="mt-3 text-3xl md:text-4xl font-extrabold tracking-tight text-[#1f2937]">
              FinMemory
            </h1>
          </div>

          {isNotRegistered && (
            <div className="w-full mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm text-center">
              Acesso restrito. Use uma conta cadastrada ou entre em contato para solicitar acesso.
            </div>
          )}

          <p className="text-lg md:text-xl text-[#666] mb-10 leading-relaxed">
            Seu assistente financeiro inteligente que organiza suas notas fiscais automaticamente do Gmail
          </p>

          <div className="flex flex-col gap-4 items-center">
            <button
              type="button"
              onClick={handleSignIn}
              className="w-full max-w-[400px] flex items-center justify-center gap-3 py-4 px-6 bg-gradient-google text-white rounded-lg font-bold text-lg shadow-[0_4px_12px_rgba(46,204,73,0.35)] hover:scale-[1.02] active:scale-[0.98] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#2ECC49]"
              aria-label="Entrar com Google"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Entrar com Google
            </button>
          </div>

          <div className="mt-10 p-6 bg-[#f8f9fa] rounded-xl text-left">
            <h2 className="text-lg font-semibold text-[#333] mb-4">✨ Como funciona:</h2>
            <ul className="list-none p-0 m-0 text-[#666] text-sm leading-loose space-y-1">
              <li>📧 Conecte seu Gmail</li>
              <li>🤖 IA processa suas notas fiscais</li>
              <li>📊 Visualize gastos organizados</li>
              <li>💰 Controle total de suas finanças</li>
            </ul>
          </div>
          {legalLinksInCard}
        </div>
        )}
        {legalFooter}
      </div>
    </>
  );
}
