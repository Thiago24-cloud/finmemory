'use client';

import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { TutorOverlay } from './TutorOverlay';

const PAD = 10;
const Z = 250;

function queryTarget(targetId) {
  if (!targetId || typeof document === 'undefined') return null;
  return document.querySelector(`[data-tour-id="${targetId}"]`);
}

/**
 * Overlay escuro + “buraco” no alvo + tutor com mascote (tutorial estilo jogo).
 *
 * @param {{
 *   active: boolean,
 *   targetId: string,
 *   stepIndex: number,
 *   stepCount: number,
 *   title?: string,
 *   body: string,
 *   advance?: 'click_target' | 'next_button',
 *   placement?: 'top' | 'bottom',
 *   mood?: 'neutral' | 'happy' | 'alert',
 *   onNext?: () => void,
 *   onSkip?: () => void,
 *   blockNavigation?: boolean,
 * }} props
 */
export function SpotlightOnboarding({
  active,
  targetId,
  stepIndex,
  stepCount,
  title,
  body,
  advance = 'next_button',
  placement = 'bottom',
  mood = 'neutral',
  onNext,
  onSkip,
  blockNavigation = false,
}) {
  const [hole, setHole] = useState(null);
  const [tooltip, setTooltip] = useState({ top: 0, left: 0, arrowLeft: 24 });
  const [ready, setReady] = useState(false);

  const measure = useCallback(() => {
    const el = queryTarget(targetId);
    if (!el) {
      setHole(null);
      return;
    }
    const r = el.getBoundingClientRect();
    const h = {
      top: r.top - PAD,
      left: r.left - PAD,
      width: r.width + PAD * 2,
      height: r.height + PAD * 2,
      centerX: r.left + r.width / 2,
      bottom: r.bottom,
      topEdge: r.top,
    };
    setHole(h);

    const cardW = Math.min(360, window.innerWidth - 32);
    const left = Math.min(
      Math.max(16, h.centerX - cardW / 2),
      window.innerWidth - cardW - 16
    );
    const top =
      placement === 'top'
        ? Math.max(16, h.topEdge - 12)
        : Math.min(window.innerHeight - 200, h.bottom + 16);
    setTooltip({
      top: placement === 'top' ? top - 140 : top,
      left,
      arrowLeft: Math.min(cardW - 24, Math.max(24, h.centerX - left)),
    });
  }, [targetId, placement]);

  useLayoutEffect(() => {
    if (!active) {
      setReady(false);
      return;
    }
    measure();
    setReady(true);
  }, [active, targetId, measure]);

  useEffect(() => {
    if (!active) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);

  useEffect(() => {
    if (!active) return undefined;
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    const el = queryTarget(targetId);
    let ro;
    if (el && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(onResize);
      ro.observe(el);
    }
    const t = window.setInterval(measure, 400);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
      ro?.disconnect();
      window.clearInterval(t);
    };
  }, [active, targetId, measure]);

  useEffect(() => {
    if (!active || advance !== 'click_target') return undefined;
    const el = queryTarget(targetId);
    if (!el) return undefined;

    const onClick = () => {
      onNext?.();
    };

    el.addEventListener('click', onClick, { capture: true });
    return () => el.removeEventListener('click', onClick, { capture: true });
  }, [active, advance, targetId, onNext, blockNavigation]);

  if (!active || !ready || typeof document === 'undefined') return null;

  const isClickStep = advance === 'click_target';

  return createPortal(
    <div className="fixed inset-0" style={{ zIndex: Z }} role="presentation">
      {hole ? (
        <div
          aria-hidden
          className="absolute rounded-2xl transition-all duration-300 ease-out pointer-events-none"
          style={{
            top: hole.top,
            left: hole.left,
            width: hole.width,
            height: hole.height,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.88)',
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/88" aria-hidden />
      )}

      {hole ? (
        <div
          className="absolute rounded-2xl border-2 border-[#00E676]/70 pointer-events-none transition-all duration-300 ease-out"
          style={{
            top: hole.top,
            left: hole.left,
            width: hole.width,
            height: hole.height,
            boxShadow: '0 0 24px rgba(0, 230, 118, 0.35)',
          }}
          aria-hidden
        />
      ) : null}

      {!hole ? (
        <div
          className="absolute inset-0 pointer-events-auto"
          onClick={onSkip}
          aria-hidden
        />
      ) : null}

      <div
        className="absolute w-[min(100vw-2rem,22.5rem)] pointer-events-auto"
        style={{ top: tooltip.top, left: tooltip.left }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="spotlight-title"
      >
        <div
          className={cn(
            'absolute w-3 h-3 rotate-45 bg-[#1C1C1E] border border-[#00E676]/40',
            placement === 'top' ? 'bottom-[-7px]' : 'top-[-7px]'
          )}
          style={{ left: tooltip.arrowLeft }}
          aria-hidden
        />
        <button
          type="button"
          onClick={onSkip}
          className="absolute -top-1 right-0 z-10 p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5"
          aria-label="Pular tutorial"
        >
          <X className="h-4 w-4" />
        </button>
        <TutorOverlay
          visible
          title={title}
          text={body}
          mood={mood}
          position={placement}
          onContinue={isClickStep ? undefined : onNext}
          continueLabel="Continuar →"
          mascotWidth={72}
        />
        <div className="flex items-center justify-between gap-2 mt-3 px-1" id="spotlight-title">
          <div className="flex gap-1" aria-hidden>
            {Array.from({ length: stepCount }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  'h-1 rounded-full transition-all',
                  i === stepIndex ? 'w-5 bg-[#00E676]' : 'w-1.5 bg-white/25'
                )}
              />
            ))}
          </div>
          {isClickStep ? (
            <span className="text-[11px] font-semibold text-[#00E676]/90">Toque no destaque ↑</span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onSkip}
          className="mt-2 px-1 text-[11px] font-medium text-white/40 hover:text-white/70"
        >
          Pular tutorial
        </button>
      </div>
    </div>,
    document.body
  );
}
