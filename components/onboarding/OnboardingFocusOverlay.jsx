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
 */
export function OnboardingFocusOverlay({
  active,
  targetId,
  handPlacement = 'bottom',
  onTargetActivate,
}) {
  const [hole, setHole] = useState(null);

  const measure = useCallback(() => {
    const el = queryTarget(targetId);
    if (!el) {
      setHole(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setHole({
      top: r.top - PAD,
      left: r.left - PAD,
      width: r.width + PAD * 2,
      height: r.height + PAD * 2,
      bottom: r.bottom + PAD,
      right: r.right + PAD,
    });
  }, [targetId]);

  useLayoutEffect(() => {
    if (!active) {
      setHole(null);
      return;
    }
    measure();
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

  const handleTargetClick = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      onTargetActivate?.();
    },
    [onTargetActivate]
  );

  if (!active || typeof document === 'undefined') return null;

  const vw = typeof window !== 'undefined' ? window.innerWidth : 0;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 0;

  return createPortal(
    <div className="fixed inset-0" style={{ zIndex: Z }} role="presentation" aria-hidden={false}>
      {hole ? (
        <>
          {/* Painéis que bloqueiam cliques fora do alvo */}
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
          {/* Halo do alvo */}
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
          {/* Área clicável só no alvo */}
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
        </>
      ) : (
        <div className="absolute inset-0 bg-black/60 pointer-events-auto" />
      )}
    </div>,
    document.body
  );
}
