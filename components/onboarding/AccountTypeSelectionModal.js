'use client';

import { useState, useCallback } from 'react';
import { ShoppingBag, Store } from 'lucide-react';
import { cn } from '../../lib/utils';
import { USER_ROLE_CONSUMER, USER_ROLE_RETAILER } from '../../lib/userType';

export function AccountTypeSelectionModal({ open, onComplete }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [hovered, setHovered] = useState(null);

  const choose = useCallback(
    async (role) => {
      if (submitting) return;
      setSubmitting(true);
      setError(null);
      try {
        await onComplete(role);
      } catch (e) {
        setError(e.message || 'Não foi possível salvar. Tente de novo.');
        setSubmitting(false);
      }
    },
    [onComplete, submitting]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[210] flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-md p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-type-title"
    >
      <div className="w-full max-w-md rounded-3xl border border-[#1E2A3A] bg-gradient-to-b from-card to-[#0a0e1a] p-6 shadow-[0_0_48px_-12px_rgba(46,204,73,0.35)] space-y-5 max-h-[92vh] overflow-y-auto">
        <div className="text-center space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary m-0">Seu perfil</p>
          <h2 id="account-type-title" className="text-[22px] font-black text-foreground leading-tight m-0">
            Como você usa o FinMemory?
          </h2>
          <p className="text-sm text-muted-foreground m-0 leading-relaxed">
            Ajustamos a lista de compras e as ferramentas para o seu dia a dia.
          </p>
        </div>

        <div className="space-y-3">
          <RoleCard
            icon={ShoppingBag}
            title="Consumidor"
            description="Para quem quer otimizar as compras de casa e encontrar os menores preços locais."
            active={hovered === USER_ROLE_CONSUMER}
            onHover={() => setHovered(USER_ROLE_CONSUMER)}
            onLeave={() => setHovered(null)}
            disabled={submitting}
            onClick={() => void choose(USER_ROLE_CONSUMER)}
          />
          <RoleCard
            icon={Store}
            title="Comerciante / Varejista"
            description="Para quem quer abastecer o estoque do negócio, gerenciar listas em grande volume e atacado."
            accent="amber"
            active={hovered === USER_ROLE_RETAILER}
            onHover={() => setHovered(USER_ROLE_RETAILER)}
            onLeave={() => setHovered(null)}
            disabled={submitting}
            onClick={() => void choose(USER_ROLE_RETAILER)}
          />
        </div>

        {error ? <p className="text-sm text-red-400 text-center m-0">{error}</p> : null}
        {submitting ? (
          <p className="text-xs text-center text-primary font-semibold m-0 animate-pulse">Salvando perfil…</p>
        ) : null}
      </div>
    </div>
  );
}

function RoleCard({ icon: Icon, title, description, onClick, disabled, active, onHover, onLeave, accent = 'primary' }) {
  const isAmber = accent === 'amber';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onFocus={onHover}
      onBlur={onLeave}
      className={cn(
        'w-full text-left rounded-2xl border p-4 transition-all duration-200',
        'bg-card/80 hover:bg-card disabled:opacity-60 disabled:pointer-events-none',
        active
          ? isAmber
            ? 'border-amber-500/50 shadow-[0_0_32px_-8px_rgba(245,158,11,0.45)] ring-1 ring-amber-500/30'
            : 'border-primary/50 shadow-[0_0_32px_-8px_hsl(var(--primary)/0.45)] ring-1 ring-primary/30'
          : 'border-[#1E2A3A] hover:border-primary/25'
      )}
    >
      <div className="flex gap-4 items-start">
        <div
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border',
            isAmber
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              : 'bg-primary/10 border-primary/30 text-primary'
          )}
        >
          <Icon className="h-6 w-6" strokeWidth={2.25} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-black text-foreground m-0">{title}</p>
          <p className="text-[12px] text-muted-foreground mt-1.5 m-0 leading-relaxed">{description}</p>
        </div>
        <span
          className={cn(
            'shrink-0 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg',
            isAmber ? 'bg-amber-500/15 text-amber-400' : 'bg-primary/15 text-primary'
          )}
        >
          Escolher
        </span>
      </div>
    </button>
  );
}
