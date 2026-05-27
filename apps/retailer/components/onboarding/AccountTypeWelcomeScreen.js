'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { Store } from 'lucide-react';
import { cn } from '../../lib/utils';
import { USER_ROLE_RETAILER } from '../../lib/userType';
import { useUserRole } from '../../contexts/UserRoleContext';

/** Perfil lojista — nome da loja antes de abrir o painel. */
export function AccountTypeWelcomeScreen() {
  const router = useRouter();
  const { update } = useSession();
  const { refreshUserRole } = useUserRole();
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const avancar = useCallback(async () => {
    const label = displayName.trim();
    if (label.length < 2) {
      setError('Informe o nome da sua loja (mín. 2 caracteres).');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/user/account-type', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: USER_ROLE_RETAILER,
          display_name: label,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Não foi possível salvar.');
        return;
      }

      try {
        await update({
          name: label,
          account_type: data.account_type,
        });
      } catch {
        /* ignore */
      }
      await refreshUserRole();
      await router.replace('/parceiros/painel');
    } catch {
      setError('Erro de rede. Tente de novo.');
    } finally {
      setSubmitting(false);
    }
  }, [displayName, update, router, refreshUserRole]);

  return (
    <div className="min-h-screen bg-[#030508] text-foreground flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/35 bg-amber-500/10 text-amber-400">
            <Store className="h-7 w-7" strokeWidth={2.25} />
          </div>
          <h1 className="text-2xl font-black m-0">Painel Parceiros</h1>
          <p className="text-sm text-muted-foreground m-0">
            Informe o nome da sua loja para continuar.
          </p>
        </div>

        <input
          type="text"
          autoComplete="organization"
          placeholder="Nome da loja"
          value={displayName}
          onChange={(e) => {
            setDisplayName(e.target.value);
            setError(null);
          }}
          className="w-full rounded-xl border border-amber-500/30 bg-background/90 px-4 py-3 text-sm font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/40"
        />

        {error ? <p className="text-sm text-red-400 text-center m-0">{error}</p> : null}

        <button
          type="button"
          disabled={submitting}
          onClick={() => void avancar()}
          className={cn(
            'w-full py-4 rounded-2xl font-black text-lg text-[#0A0E1A]',
            'bg-gradient-to-r from-[#2ECC49] to-[#3dff7a]',
            'shadow-[0_0_32px_rgba(46,204,73,0.55)]',
            'active:scale-[0.98] transition-transform disabled:opacity-50'
          )}
        >
          {submitting ? 'Salvando…' : 'Entrar no painel'}
        </button>
      </div>
    </div>
  );
}
