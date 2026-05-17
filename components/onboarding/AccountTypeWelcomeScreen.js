'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { ShoppingBag, Store, Sparkles, Swords } from 'lucide-react';
import { cn } from '../../lib/utils';
import { USER_ROLE_CONSUMER, USER_ROLE_RETAILER } from '../../lib/userType';
import { useMissionsToday } from '../missions/MissionsTodayContext';
import { useUserRole } from '../../contexts/UserRoleContext';

/**
 * Tela inicial gamificada — escolha Consumidor vs Varejista (capa FinMemory).
 */
export function AccountTypeWelcomeScreen() {
  const router = useRouter();
  const { update } = useSession();
  const { missions } = useMissionsToday();
  const { refreshUserRole } = useUserRole();
  const [role, setRole] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const totalXpToday = missions.reduce((s, m) => s + (m.xp_reward || 0), 0);
  const completedMissions = missions.filter((m) => m.completed).length;

  const avancar = useCallback(async () => {
    if (!role) {
      setError('Escolha Consumidor ou Comerciante para continuar.');
      return;
    }
    const label = displayName.trim();
    if (label.length < 2) {
      setError(
        role === USER_ROLE_RETAILER
          ? 'Informe o nome da sua loja (mín. 2 caracteres).'
          : 'Informe seu nome (mín. 2 caracteres).'
      );
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/user/account-type', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
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

      const dest = role === USER_ROLE_RETAILER ? '/scan-product' : '/dashboard';
      await router.replace(dest);
    } catch {
      setError('Erro de rede. Tente de novo.');
    } finally {
      setSubmitting(false);
    }
  }, [role, displayName, update, router, refreshUserRole]);

  return (
    <div className="min-h-screen bg-[#030508] text-foreground pb-10">
      <div className="sticky top-0 z-20 border-b border-primary/20 bg-[#030508]/90 backdrop-blur-md px-4 py-2.5">
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2ECC49] to-[#16a34a] flex items-center justify-center text-[11px] font-black text-[#0A0E1A] shadow-[0_0_12px_rgba(46,204,73,0.5)]">
              1
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-primary uppercase tracking-wider m-0 flex items-center gap-1">
                <Sparkles className="w-3 h-3" aria-hidden />
                Missões de hoje
              </p>
              <p className="text-[11px] text-muted-foreground m-0 truncate">
                Até <span className="text-amber-400 font-bold">+{totalXpToday} XP</span> ao jogar
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[10px] text-muted-foreground m-0 flex items-center justify-end gap-1">
              <Swords className="w-3 h-3 text-amber-400" aria-hidden />
              {completedMissions}/{missions.length}
            </p>
          </div>
        </div>
      </div>

      <div className="relative w-full max-w-md mx-auto px-3 pt-2">
        <div className="relative rounded-2xl overflow-hidden border border-primary/15 shadow-[0_0_40px_-12px_rgba(46,204,73,0.45)]">
          <Image
            src="/onboarding/capa-perfil-finmemory.png"
            alt="FinMemory — Como você vai jogar a vida real hoje?"
            width={1080}
            height={1920}
            priority
            className="w-full h-auto object-cover"
            sizes="(max-width: 448px) 100vw"
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#030508]"
            aria-hidden
          />
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 -mt-6 relative z-10 space-y-4">
        <div className="text-center space-y-1 px-1">
          <h1 className="text-[22px] font-black leading-tight m-0 text-transparent bg-clip-text bg-gradient-to-r from-[#2ECC49] via-[#7dff9a] to-[#2ECC49] drop-shadow-[0_0_24px_rgba(46,204,73,0.35)]">
            Como você vai jogar a vida real hoje?
          </h1>
          <p className="text-sm text-muted-foreground m-0">
            Escolha o perfil que melhor se adapta à sua rotina.
          </p>
        </div>

        <ProfilePickCard
          icon={ShoppingBag}
          title="Consumidor Final"
          hint="Digite seu nome e crie seu boneco"
          selected={role === USER_ROLE_CONSUMER}
          onSelect={() => {
            setRole(USER_ROLE_CONSUMER);
            setError(null);
          }}
        >
          {role === USER_ROLE_CONSUMER ? (
            <input
              type="text"
              autoComplete="name"
              placeholder="Seu nome"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                setError(null);
              }}
              className="w-full mt-3 rounded-xl border border-primary/30 bg-background/90 px-4 py-3 text-sm font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          ) : null}
        </ProfilePickCard>

        <ProfilePickCard
          icon={Store}
          title="Comerciante / Varejista"
          hint="Qual é o nome da sua loja?"
          accent="amber"
          selected={role === USER_ROLE_RETAILER}
          onSelect={() => {
            setRole(USER_ROLE_RETAILER);
            setError(null);
          }}
        >
          {role === USER_ROLE_RETAILER ? (
            <input
              type="text"
              autoComplete="organization"
              placeholder="Nome da loja"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                setError(null);
              }}
              className="w-full mt-3 rounded-xl border border-amber-500/30 bg-background/90 px-4 py-3 text-sm font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            />
          ) : null}
        </ProfilePickCard>

        {error ? <p className="text-sm text-red-400 text-center m-0">{error}</p> : null}

        <button
          type="button"
          disabled={submitting}
          onClick={() => void avancar()}
          className={cn(
            'w-full py-4 rounded-2xl font-black text-lg text-[#0A0E1A]',
            'bg-gradient-to-r from-[#2ECC49] to-[#3dff7a]',
            'shadow-[0_0_32px_rgba(46,204,73,0.55),inset_0_1px_0_rgba(255,255,255,0.25)]',
            'border-2 border-[#5dff8a]/80',
            'active:scale-[0.98] transition-transform disabled:opacity-50'
          )}
        >
          {submitting ? 'Salvando…' : 'Avançar'}
        </button>

        <p className="text-[11px] text-center text-muted-foreground leading-relaxed m-0 pb-4">
          Ganhe XP nas missões diárias ao usar o mapa, scanner e lista de compras — o progresso começa agora.
        </p>
      </div>
    </div>
  );
}

function ProfilePickCard({ icon: Icon, title, hint, selected, onSelect, accent, children }) {
  const isAmber = accent === 'amber';
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full text-left rounded-2xl border p-4 transition-all duration-200',
        'bg-[#0a1018]/90 backdrop-blur-sm',
        selected
          ? isAmber
            ? 'border-amber-500/50 shadow-[0_0_28px_-8px_rgba(245,158,11,0.5)] ring-1 ring-amber-500/25'
            : 'border-primary/50 shadow-[0_0_28px_-8px_rgba(46,204,73,0.45)] ring-1 ring-primary/25'
          : 'border-[#1E2A3A]/80 hover:border-primary/30'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border',
            isAmber
              ? 'bg-amber-500/10 border-amber-500/35 text-amber-400'
              : 'bg-primary/10 border-primary/35 text-primary'
          )}
        >
          <Icon className="h-5 w-5" strokeWidth={2.25} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-black text-foreground m-0">{title}</p>
          <p className="text-[12px] text-muted-foreground mt-1 m-0">{hint}</p>
        </div>
        {selected ? (
          <span
            className={cn(
              'shrink-0 text-[10px] font-black uppercase px-2 py-1 rounded-lg',
              isAmber ? 'bg-amber-500/20 text-amber-400' : 'bg-primary/20 text-primary'
            )}
          >
            ✓
          </span>
        ) : null}
      </div>
      {children}
    </button>
  );
}
