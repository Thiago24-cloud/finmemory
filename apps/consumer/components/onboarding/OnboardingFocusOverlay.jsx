'use client';

import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { OnboardingHandPointer } from './OnboardingHandPointer';

const PAD = 10;
const Z = 250;

function queryTarget(targetId) {
  if (!targetId || typeof document === 'undefined') return null;
  return document.querySelector(`[data-tour-id="${targetId}"]`);
}

/**
 * Overlay escuro com buraco no alvo, bloqueio de cliques e mãozinha.
 * Toque no alvo chama `onTargetActivate` (abre modal premium).
 * Sem alvo no DOM: não bloqueia a tela; `onTargetMissing` fecha o tutorial.
 */
export function OnboardingFocusOverlay({
  active,
  targetId,
  handPlacement = 'bottom',
  onTargetActivate,
  onTargetMissing,
}) {
  const [hole, setHole] = useState(null);

  const measure = useCallback(() => {
    const el = queryTarget(targetId);
    if (!el) {
      setHole(null);
      return false;
    }
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) {
      setHole(null);
      return false;
    }
    setHole({
      top: r.top - PAD,
      left: r.left - PAD,
      width: r.width + PAD * 2,
      height: r.height + PAD * 2,
      bottom: r.bottom + PAD,
      right: r.right + PAD,
    });
    return true;
  }, [targetId]);

  useLayoutEffect(() => {
    if (!active) {
      setHole(null);
      return;
    }
    measure();
  }, [active, targetId, measure]);

  /** Sem alvo visível após layout: não bloquear a app — avisa o pai para saltar/fechar. */
  useEffect(() => {
    if (!active || !targetId || !onTargetMissing) return undefined;
    let cancelled = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 8;
    const tick = () => {
      if (cancelled) return;
      if (measure()) return;
      attempts += 1;
      if (attempts >= MAX_ATTEMPTS) {
        onTargetMissing();
        return;
      }
      window.setTimeout(tick, 250);
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [active, targetId, measure, onTargetMissing]);

  useEffect(() => {
    if (!active || !hole) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active, hole]);

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

  const handleTargetClick = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      onTargetActivate?.();
    },
    [onTargetActivate]
  );

  if (!active || typeof document === 'undefined' || !hole) return null;

  const vw = typeof window !== 'undefined' ? window.innerWidth : 0;

  return createPortal(
    <div className="fixed inset-0" style={{ zIndex: Z }} role="presentation" aria-hidden={false}>
      <div
        className="absolute left-0 right-0 top-0 bg-black/60 pointer-events-auto"
        style={{ height: Math.max(0, hole.top) }}
      />
      <div
        className="absolute left-0 right-0 bottom-0 bg-black/60 pointer-events-auto"
        style={{ top: hole.top + hole.height }}
      />
      <div
        className="absolute left-0 bg-black/60 pointer-events-auto"
        style={{ top: hole.top, width: Math.max(0, hole.left), height: hole.height }}
      />
      <div
        className="absolute bg-black/60 pointer-events-auto"
        style={{
          top: hole.top,
          left: hole.left + hole.width,
          width: Math.max(0, vw - hole.left - hole.width),
          height: hole.height,
        }}
      />
      <div
        className="absolute rounded-2xl border-2 border-[#00E676]/75 pointer-events-none transition-all duration-300 ease-out"
        style={{
          top: hole.top,
          left: hole.left,
          width: hole.width,
          height: hole.height,
          boxShadow: '0 0 28px rgba(0, 230, 118, 0.4)',
        }}
      />
      <button
        type="button"
        className="absolute rounded-2xl bg-transparent cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00E676]"
        style={{
          top: hole.top,
          left: hole.left,
          width: hole.width,
          height: hole.height,
          zIndex: Z + 1,
        }}
        onClick={handleTargetClick}
        aria-label="Continuar tutorial neste botão"
      />
      <OnboardingHandPointer hole={hole} placement={handPlacement} />
    </div>,
    document.body
  );
}
