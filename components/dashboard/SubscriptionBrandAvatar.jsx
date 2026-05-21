'use client';

import { useState } from 'react';
import { Receipt } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getSubscriptionBrandTheme } from '../../lib/subscriptionBrandThemes';

/**
 * Avatar de marca (Netflix, Amazon, Canva…) — mesmo padrão visual dos cartões Open Finance.
 */
export function SubscriptionBrandAvatar({ titulo, categoria, size = 44, className }) {
  const theme = getSubscriptionBrandTheme({ titulo, categoria });
  const [broken, setBroken] = useState(false);
  const px = Number(size) || 44;
  const showLogo = theme.logoUrl && !broken;

  return (
    <div
      className={cn(
        'relative shrink-0 overflow-hidden rounded-2xl shadow-sm ring-1 ring-black/10',
        className
      )}
      style={{
        width: px,
        height: px,
        backgroundColor: theme.bgColor,
        boxShadow: `0 4px 14px rgba(0,0,0,0.12), 0 0 0 1px ${theme.ringColor}`,
      }}
      aria-hidden
    >
      {showLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={theme.logoUrl}
          alt=""
          className="h-full w-full object-contain p-1.5 bg-white"
          style={{ transform: `scale(${theme.logoScale})` }}
          onError={() => setBroken(true)}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-white/90">
          <Receipt className="h-5 w-5" strokeWidth={2} aria-hidden />
        </div>
      )}
    </div>
  );
}
