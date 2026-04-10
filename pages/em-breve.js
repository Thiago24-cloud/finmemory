import Head from 'next/head';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { Loader2 } from 'lucide-react';

/**
 * Utilizador autenticado mas fora da lista de acesso (beta / lockdown).
 */
export default function EmBrevePage() {
  const { data: session, status } = useSession();

  return (
    <>
      <Head>
        <title>Em breve — FinMemory</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <div className="min-h-screen bg-[#f8f9fa] flex flex-col items-center justify-center px-5 py-16">
        <div className="w-full max-w-md rounded-2xl bg-white border border-[#e5e7eb] shadow-[0_8px_24px_rgba(0,0,0,0.06)] p-8 text-center">
          {status === 'loading' ? (
            <div className="flex justify-center py-8 text-[#2ECC49]">
              <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
            </div>
          ) : (
            <>
              <p className="text-4xl mb-4" aria-hidden>
                🚀
              </p>
              <h1 className="text-xl font-bold text-[#333] m-0 mb-3">FinMemory em testes</h1>
              <p className="text-sm text-[#666] leading-relaxed m-0 mb-6">
                Esta versão está disponível apenas para um grupo fechado. Em breve abriremos para todos.
              </p>
              {session?.user?.email && (
                <p className="text-xs text-[#999] mb-6 break-all">
                  Sessão: {session.user.email}
                </p>
              )}
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="w-full py-3 rounded-xl bg-[#f0f0f0] text-[#333] text-sm font-semibold hover:bg-[#e5e5e5] transition-colors"
                >
                  Sair desta conta
                </button>
                <Link
                  href="/"
                  className="block w-full py-3 rounded-xl text-center text-sm font-semibold text-[#2ECC49] hover:underline"
                >
                  Voltar ao início
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
