'use client';

import { useLayoutEffect, useRef } from 'react';

/**
 * Rótulo que desliza da posição do toque até a calculadora (feedback visual).
 */
export function CalcFlyParticle({ x0, y0, x1, y1, label }) {
  const elRef = useRef(null);

  useLayoutEffect(() => {
    const el = elRef.current;
    if (!el) return undefined;
    el.style.transition = 'none';
    el.style.left = `${x0}px`;
    el.style.top = `${y0}px`;
    el.style.opacity = '1';
    el.style.transform = 'translate(-50%, -50%) scale(1)';
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        el.style.transition =
          'left 0.48s cubic-bezier(0.22, 1, 0.36, 1), top 0.48s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.48s ease-out, transform 0.48s ease-out';
        el.style.left = `${x1}px`;
        el.style.top = `${y1}px`;
        el.style.opacity = '0.15';
        el.style.transform = 'translate(-50%, -50%) scale(0.88)';
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [x0, y0, x1, y1, label]);

  return (
    <div
      ref={elRef}
      className="pointer-events-none fixed z-[100] rounded-lg bg-[#0b1220]/95 px-2 py-1 text-xs font-bold tabular-nums text-[#2ECC49] shadow-lg ring-1 ring-[#2ECC49]/30"
      style={{
        left: `${x0}px`,
        top: `${y0}px`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      {label}
    </div>
  );
}
