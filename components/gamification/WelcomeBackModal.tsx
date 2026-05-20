'use client';

import { Flame, Sparkles, X } from 'lucide-react';

export type WelcomeBackModalProps = {
  open: boolean;
  displayName: string;
  currentStreak: number;
  bonusCopy: string;
  onDismiss: () => void;
  onCta: () => void;
};

export function WelcomeBackModal({
  open,
  displayName,
  currentStreak,
  bonusCopy,
  onDismiss,
  onCta,
}: WelcomeBackModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/70 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-back-title"
    >
      <div className="relative w-full max-w-md rounded-3xl border border-border/60 bg-card px-6 pb-8 pt-10 shadow-2xl">
        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground hover:bg-muted/60"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>

        <h2
          id="welcome-back-title"
          className="text-center text-2xl font-bold tracking-tight text-foreground"
        >
          {displayName}, que bom que você voltou!
        </h2>
        <p className="mt-3 text-center text-base text-muted-foreground">
          Sentimos sua falta no controle das suas finanças. Vamos retomar o jogo?
        </p>

        {currentStreak > 0 ? (
          <div className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-orange-500/15 px-4 py-3 text-orange-600 dark:text-orange-300">
            <Flame className="h-5 w-5 shrink-0" />
            <span className="text-sm font-semibold">
              Ofensiva atual: {currentStreak} dia{currentStreak === 1 ? '' : 's'}
            </span>
          </div>
        ) : null}

        <div className="mt-6 flex gap-3 rounded-2xl border border-primary/25 bg-primary/10 p-4">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p className="text-sm font-medium leading-snug text-foreground">{bonusCopy}</p>
        </div>

        <button
          type="button"
          onClick={onCta}
          className="mt-8 w-full rounded-2xl bg-primary py-4 text-lg font-bold text-primary-foreground shadow-lg transition hover:opacity-95 active:scale-[0.98]"
        >
          Bora jogar!
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="mt-3 w-full py-2 text-sm font-medium text-muted-foreground"
        >
          Ver depois
        </button>
      </div>
    </div>
  );
}
