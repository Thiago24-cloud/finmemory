'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { cn } from '../../lib/utils';
import { requireAppUnlockAfterSession } from '../../lib/appUnlockGate';

/** Tempo mínimo desde o arranque até iniciar o fade-out (marca + “carregamento”). */
const SPLASH_MIN_VISIBLE_MS = 3000;
const FADE_OUT_MS = 420;

/**
 * Splash de arranque: fundo branco, marca com fade-in + pulso suave, ≥3s visível,
 * fade-out revelando a app já montada por baixo (sem alterar fluxo de navegação).
 */
export function AppSplashGate({ children }) {
  const { status } = useSession();
  const mountedAt = useRef(typeof performance !== 'undefined' ? performance.now() : Date.now());
  const [phase, setPhase] = useState('splash'); // splash | fade | off

  useEffect(() => {
    if (status === 'loading') return undefined;

    let cancelled = false;
    const run = async () => {
      try {
        await requireAppUnlockAfterSession();
      } catch {
        /* não bloquear o app */
      }
      if (cancelled) return;

      const now =
        typeof performance !== 'undefined' ? performance.now() : Date.now();
      const elapsed = now - mountedAt.current;
      const wait = Math.max(0, SPLASH_MIN_VISIBLE_MS - elapsed);
      await new Promise((r) => setTimeout(r, wait));
      if (cancelled) return;

      setPhase('fade');
      await new Promise((r) => setTimeout(r, FADE_OUT_MS));
      if (cancelled) return;
      setPhase('off');
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [status]);

  return (
    <>
      <div aria-hidden={phase !== 'off'} className={phase !== 'off' ? 'pointer-events-none' : undefined}>
        {children}
      </div>
      {phase !== 'off' && (
        <div
          className={cn(
            'fm-splash-root fixed inset-0 z-[2147483000] flex flex-col items-center justify-center bg-[#FFFFFF] px-6',
            'pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]',
            phase === 'fade' && 'fm-splash-exit'
          )}
          role="status"
          aria-live="polite"
          aria-busy={phase === 'splash'}
          aria-label="A iniciar FinMemory"
        >
          <span className="sr-only">A carregar o FinMemory</span>
          <div className="fm-splash-logo-in flex flex-col items-center justify-center">
            <div className="fm-splash-logo-pulse flex size-[7.5rem] items-center justify-center bg-[#FFFFFF]">
              <Image
                src="/logo.png"
                alt="FinMemory"
                width={120}
                height={120}
                priority
                placeholder="empty"
                className="block h-full w-full object-contain bg-transparent"
              />
            </div>
            <p className="mt-7 text-[12px] font-bold uppercase tracking-[0.16em] text-[#1A1A1A]">
              FinMemory
            </p>
          </div>
        </div>
      )}
    </>
  );
}
