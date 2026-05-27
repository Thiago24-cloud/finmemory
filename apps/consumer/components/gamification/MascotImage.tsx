'use client';

import { cn } from '../../lib/utils';
import { MASCOT_IMAGE_SRC } from '../../lib/gamification/characterStateConfig';

type MascotImageProps = {
  className?: string;
  /** Largura intrínseca (altura proporcional 400:450). */
  width?: number;
};

/**
 * Mascote via &lt;img&gt; com dimensões explícitas — evita SVG 100%×100% invisível em alguns browsers.
 */
export function MascotImage({ className, width = 400 }: MascotImageProps) {
  const height = Math.round((width * 450) / 400);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={MASCOT_IMAGE_SRC}
      alt="Mascote FinMemory"
      width={width}
      height={height}
      className={cn('object-contain object-bottom', className)}
      draggable={false}
      decoding="async"
    />
  );
}
