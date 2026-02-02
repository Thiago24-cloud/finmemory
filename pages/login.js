import { useSession, signIn } from 'next-auth/react';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

/**
 * Página de login – design Lovable: gradiente roxo, card branco, botão Google.
 */
export default function Login() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/dashboard?success=true');
    }
  }, [status, router]);

  const handleSignIn = () => {
    signIn('google', { callbackUrl: '/dashboard?success=true' });
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-primary p-5">
        <div className="bg-white rounded-[20px] p-10 text-center shadow-card-lovable">
          <div className="text-4xl mb-4 animate-pulse">⏳</div>
          <p className="text-[#666]">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-5 bg-gradient-primary font-sans">
      <div className="bg-white rounded-[20px] p-8 md:p-10 text-center shadow-[0_20px_60px_rgba(0,0,0,0.3)] max-w-[600px] w-full">
        <h1 className="text-4xl md:text-5xl font-bold mb-5 text-gradient-primary">
          🚀 FinMemory
        </h1>
        <p className="text-lg md:text-xl text-[#666] mb-10 leading-relaxed">
          Seu assistente financeiro inteligente que organiza suas notas fiscais automaticamente do Gmail
        </p>

        <div className="flex flex-col gap-4 items-center">
          <button
            type="button"
            onClick={handleSignIn}
            className="w-full max-w-[400px] flex items-center justify-center gap-3 py-4 px-6 bg-gradient-google text-white rounded-lg font-bold text-lg shadow-[0_4px_12px_rgba(52,168,83,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#667eea]"
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

          <Link
            href="/"
            className="w-full max-w-[400px] inline-flex justify-center py-3.5 px-6 bg-transparent text-[#667eea] border-2 border-[#667eea] rounded-lg font-semibold text-base hover:bg-[#667eea] hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#667eea] focus-visible:ring-offset-2"
          >
            Voltar ao início
          </Link>
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
      </div>
    </div>
  );
}
