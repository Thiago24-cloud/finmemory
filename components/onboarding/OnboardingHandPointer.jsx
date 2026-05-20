'use client';

import { cn } from '../../lib/utils';

/**
 * Indicador “mãozinha” com bounce sutil, posicionado em relação ao retângulo do alvo.
 *
 * @param {{
 *   hole: { top: number; left: number; width: number; height: number; bottom: number } | null,
 *   placement?: 'top' | 'bottom' | 'left' | 'right',
 *   className?: string,
 * }} props
 */
export function OnboardingHandPointer({ hole, placement = 'bottom', className }) {
  if (!hole) return null;

  const size = 44;
  let top = hole.bottom + 6;
  let left = hole.left + hole.width / 2 - size / 2;

  if (placement === 'top') {
    top = hole.top - size - 8;
  } else if (placement === 'left') {
    top = hole.top + hole.height / 2 - size / 2;
    left = hole.left - size - 6;
  } else if (placement === 'right') {
    top = hole.top + hole.height / 2 - size / 2;
    left = hole.left + hole.width + 6;
  }

  top = Math.max(8, Math.min(top, typeof window !== 'undefined' ? window.innerHeight - size - 8 : top));
  left = Math.max(8, Math.min(left, typeof window !== 'undefined' ? window.innerWidth - size - 8 : left));

  return (
    <div
      className={cn('absolute pointer-events-none z-[252] select-none', className)}
      style={{ top, left, width: size, height: size }}
      aria-hidden
    >
      <span
        className="block text-[2.35rem] leading-none animate-onboarding-hand-bounce motion-reduce:animate-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
        role="img"
      >
        👆
      </span>
    </div>
  );
}
