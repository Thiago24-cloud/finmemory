import { useState } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import { useRouter } from 'next/router';

/**
 * Tela de boas-vindas: logo + cadastro por email.
 * Após cadastro, redireciona para o mapa (primeira tela do app).
 */
export default function WelcomePage() {
  const router = useRouter();
  const { msg } = router.query;
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isNotRegistered = msg === 'nao-cadastrado';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Digite seu e-mail.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Não foi possível cadastrar. Tente de novo.');
        setLoading(false);
        return;
      }
      if (data.approved !== false) {
        router.push('/login?callbackUrl=/mapa');
        return;
      }
      setError('Cadastro recebido! Você receberá acesso em breve.');
    } catch (err) {
      setError('Erro de conexão. Tente de novo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Finmemory – Boas-vindas</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm flex flex-col items-center">
          {/* Logo */}
          <div className="mb-8 flex justify-center">
            <Image
              src="/logo.png"
              alt="Finmemory"
              width={280}
              height={80}
              priority
              className="object-contain"
            />
          </div>
          {isNotRegistered && (
            <div className="w-full mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm text-center">
              Acesso restrito. Cadastre seu e-mail (conta Google) e faça login para acessar o app.
            </div>
          )}
          <p className="text-[#333] text-center text-lg mb-8">
            Cadastre seu e-mail <strong>Google</strong> (@gmail.com) para acessar. Após o cadastro, faça login e a primeira tela será o mapa.
          </p>
          <form onSubmit={handleSubmit} className="w-full space-y-4">
            <label htmlFor="email" className="block text-sm font-medium text-[#333] mb-1">
              E-mail (conta Google)
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@gmail.com"
              disabled={loading}
              className="w-full px-4 py-3 rounded-xl border border-[#e5e7eb] text-[#333] placeholder-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#2ECC49] focus:border-[#2ECC49] disabled:opacity-60"
              autoComplete="email"
            />
            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-[#2ECC49] text-white font-semibold hover:bg-[#22a83a] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Cadastrando...' : 'Quero acessar'}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-[#6b7280]">
            Só aceitamos contas @gmail.com ou @googlemail.com. Após cadastrar, faça login com o mesmo e-mail para acessar o mapa e a análise de gastos.
          </p>
        </div>
      </div>
    </>
  );
}
