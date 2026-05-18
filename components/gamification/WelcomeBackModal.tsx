'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Flame, Sparkles, X } from 'lucide-react';
import {
  CHARACTER_BUBBLE_DELAY_MS,
  CHARACTER_CLICK_DEBOUNCE_MS,
  mascotAnimationClass,
} from '../../lib/gamification/characterAnimation';
import { MascotImage } from './MascotImage';
import { pickRandomSpeech } from '../../lib/gamification/characterSpeeches.js';
import { cn } from '../../lib/utils';

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
  const [isBouncing, setIsBouncing] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const [greeting, setGreeting] = useState('');
  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastClickRef = useRef(0);

  const runEntrance = useCallback((line?: string) => {
    if (line) setGreeting(line);
    setIsBouncing(true);
    setShowBubble(false);
    if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
    bubbleTimerRef.current = setTimeout(() => {
      setIsBouncing(false);
      setShowBubble(true);
      bubbleTimerRef.current = null;
    }, CHARACTER_BUBBLE_DELAY_MS);
  }, []);

  useEffect(() => {
    if (!open) {
      setShowBubble(false);
      setIsBouncing(false);
      return undefined;
    }
    const line = pickRandomSpeech('META_BATIDA');
    runEntrance(line);
    return () => {
      if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
    };
  }, [open, runEntrance]);

  const handleMascotClick = () => {
    const now = Date.now();
    if (now - lastClickRef.current < CHARACTER_CLICK_DEBOUNCE_MS) return;
    lastClickRef.current = now;
    runEntrance(pickRandomSpeech('META_BATIDA'));
  };

  if (!open) return null;

  const mascotClass = mascotAnimationClass('float-idle', isBouncing);

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

        <button
          type="button"
          onClick={handleMascotClick}
          className="mx-auto flex cursor-pointer flex-col items-center outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full"
          aria-label="Mascote FinMemory — toque para nova mensagem"
        >
          <div className="flex items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-orange-500/20 p-3 ring-2 ring-primary/30">
            <div className={cn('container-personagem', mascotClass)}>
              <MascotImage width={130} className="pointer-events-none w-full h-auto" />
            </div>
          </div>
          {showBubble && greeting ? (
            <p className="speech-bubble-appear mt-3 max-w-[260px] rounded-2xl border-[3px] border-[#EAE6DF] bg-white px-4 py-2.5 text-center text-sm font-semibold text-foreground shadow-sm dark:border-border dark:bg-card">
              {greeting}
            </p>
          ) : null}
        </button>

        <h2
          id="welcome-back-title"
          className="mt-6 text-center text-2xl font-bold tracking-tight text-foreground"
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
