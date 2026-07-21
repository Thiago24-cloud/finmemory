'use client';

import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { ChefHat, KeyRound, Loader2, Store } from 'lucide-react';
import { EQUIPE_LOGIN_API } from '../../lib/merchant/painelApiPaths';

export default function EquipeEntrarPage() {
  const router = useRouter();
  const [codigo, setCodigo] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch(EQUIPE_LOGIN_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo_loja: codigo, pin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Não foi possível entrar.');
        return;
      }
      await router.replace('/parceiros/equipe');
    } catch {
      setError('Erro de rede.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Head>
        <title>Entrar — Equipe FinMemory</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="robots" content="noindex" />
      </Head>
      <div className="min-h-screen bg-[#0f1419] text-white flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 mb-3">
              <ChefHat className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-black m-0">Equipe da loja</h1>
            <p className="text-sm text-white/50 m-0 mt-1">
              Garçom e cozinha — só a tela do seu papel
            </p>
          </div>

          <form onSubmit={submit} className="space-y-3">
            <label className="block">
              <span className="text-xs text-white/45 flex items-center gap-1 mb-1">
                <Store className="h-3.5 w-3.5" /> Código da loja
              </span>
              <input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                placeholder="Ex: A1B2C3"
                autoCapitalize="characters"
                autoComplete="off"
                required
                className="w-full h-14 rounded-2xl border border-white/15 bg-white/5 px-4 text-lg font-bold tracking-widest text-center outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </label>
            <label className="block">
              <span className="text-xs text-white/45 flex items-center gap-1 mb-1">
                <KeyRound className="h-3.5 w-3.5" /> Seu PIN
              </span>
              <input
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                minLength={4}
                maxLength={6}
                className="w-full h-14 rounded-2xl border border-white/15 bg-white/5 px-4 text-2xl font-black tracking-[0.4em] text-center outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </label>

            {error ? (
              <p className="text-sm text-red-300 bg-red-500/15 border border-red-500/30 rounded-xl px-3 py-2 m-0">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="w-full h-14 rounded-2xl bg-emerald-500 text-[#0a0e14] font-black text-base border-0 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
              Entrar
            </button>
          </form>

          <p className="text-center text-[11px] text-white/35 m-0 mt-6">
            Peça o código e o PIN ao dono do restaurante.
          </p>
        </div>
      </div>
    </>
  );
}
