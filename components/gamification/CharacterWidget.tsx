'use client';

import { cn } from '../../lib/utils';
import { useCharacterEngine } from '../../hooks/useCharacterEngine';
import { mascotAnimationClass } from '../../lib/gamification/characterAnimation';
import { MASCOT_IMAGE_SRC } from '../../lib/gamification/characterStateConfig';

export type CharacterSignals = {
  context?: 'dashboard' | 'map';
  loading?: boolean;
  hasOpenFinanceAccounts?: boolean;
  syncing?: boolean;
  justSynced?: boolean;
  expenseTotal?: number;
  incomeTotal?: number;
  allMissionsComplete?: boolean;
  hasAnyMission?: boolean;
  streakCurrent?: number;
  welcomeBackToday?: boolean;
};

type CharacterWidgetProps = {
  signals: CharacterSignals;
  className?: string;
  syncServer?: boolean;
  /** `map` — overlay compacto sobre o mapa de preços */
  variant?: 'dashboard' | 'map';
};

export function CharacterWidget({
  signals,
  className,
  syncServer = false,
  variant = 'dashboard',
}: CharacterWidgetProps) {
  const { engine, speech, isBouncing, showBubble, refreshSpeech } = useCharacterEngine(signals, {
    syncServer,
  });

  const ui = engine.ui_config || {};
  const glow = ui.background_glow_color || 'rgba(99, 102, 241, 0.15)';
  const mascotClass = mascotAnimationClass(engine.animation_profile, isBouncing);
  const isMap = variant === 'map';

  if (signals.loading) {
    return (
      <div
        className={cn(
          isMap ? 'h-20 animate-pulse rounded-xl bg-white/80' : 'mx-5 mt-3 h-[130px] animate-pulse rounded-2xl bg-muted/40',
          className
        )}
        aria-hidden
      />
    );
  }

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-2xl border',
        isMap
          ? 'mt-1 border-[#dadce0]/90 bg-white/95 shadow-[0_2px_8px_rgba(60,64,67,0.12)] backdrop-blur-sm'
          : 'mx-5 mt-3 border-border/60',
        className
      )}
      style={
        isMap
          ? undefined
          : {
              boxShadow: `0 8px 32px ${glow}`,
              background: `linear-gradient(135deg, ${glow}, transparent 55%)`,
            }
      }
      aria-label="Assistente FinMemory"
    >
      <div
        className={cn(
          'relative flex items-end backdrop-blur-md bg-gradient-to-br',
          isMap ? 'gap-2 p-2.5' : 'gap-3 p-4',
          ui.accent_class || 'from-primary/15 to-primary/5'
        )}
      >
        <button
          type="button"
          onClick={refreshSpeech}
          className="group relative shrink-0 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl"
          aria-label="Trocar mensagem do mascote"
        >
          <div
            className={cn(
              'container-personagem relative',
              isMap && '![width:88px]',
              mascotClass
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={MASCOT_IMAGE_SRC}
              alt="Mascote FinMemory"
              className="object-contain object-bottom drop-shadow-md pointer-events-none"
              draggable={false}
            />
            {ui.confetti ? (
              <span className="pointer-events-none absolute -top-1 -right-1 text-lg animate-bounce">
                ✨
              </span>
            ) : null}
          </div>
        </button>

        {showBubble ? (
          <div
            className={cn(
              'speech-bubble-appear relative flex-1 rounded-2xl border text-left shadow-sm',
              isMap
                ? 'border-[#EAE6DF] bg-white px-3 py-2'
                : 'border-border/50 bg-card/90 px-4 py-3 border-[3px] border-[#EAE6DF]/80 dark:border-border/50'
            )}
          >
            <span
              className={cn(
                'absolute -left-2 rotate-45 border-b border-l',
                isMap
                  ? 'bottom-4 h-2.5 w-2.5 border-[#EAE6DF] bg-white'
                  : 'bottom-6 h-3 w-3 border-border/50 bg-card/90'
              )}
            />
            <p
              className={cn(
                'font-bold uppercase tracking-wider text-primary',
                isMap ? 'text-[9px] mb-0.5' : 'text-[10px] mb-1'
              )}
            >
              {ui.emoji} {moodLabel(engine.mood_level)}
            </p>
            <p
              className={cn(
                'font-semibold leading-snug text-foreground',
                isMap ? 'text-xs' : 'text-sm'
              )}
            >
              {speech}
            </p>
          </div>
        ) : (
          <div className={cn('flex-1', isMap ? 'min-h-[3.25rem]' : 'min-h-[4.5rem]')} aria-hidden />
        )}
      </div>
    </section>
  );
}

function moodLabel(mood?: string) {
  switch (mood) {
    case 'HAPPY':
      return 'No comando';
    case 'FOCUSED':
      return 'Modo caça-preço';
    case 'CELEBRATING':
      return 'Vitória!';
    case 'WORRIED':
      return 'Atenção';
    default:
      return 'FinMemory';
  }
}
