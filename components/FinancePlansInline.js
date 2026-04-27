'use client';

import Link from 'next/link';

/**
 * Copy única para comunicação de planos de finanças (Free / Pro / Família).
 * Evita divergência entre mapa, dashboard e CTAs de jornada.
 */
export function FinancePlansInline({
  className = '',
  emphasize = false,
  showLink = false,
  linkClassName = '',
}) {
  return (
    <p className={className}>
      <span className={emphasize ? 'font-semibold' : ''}>Planos Finanças:</span>{' '}
      <span className={emphasize ? 'font-semibold' : ''}>Free</span> (registro manual),{' '}
      <span className={emphasize ? 'font-semibold' : ''}>Pro</span> (Open Finance + metas inteligentes) e{' '}
      <span className={emphasize ? 'font-semibold' : ''}>Família</span> (orçamento compartilhado da casa)
      {showLink ? (
        <>
          .{' '}
          <Link href="/planos" className={linkClassName}>
            Ver planos
          </Link>
        </>
      ) : (
        '.'
      )}
    </p>
  );
}

export default FinancePlansInline;
