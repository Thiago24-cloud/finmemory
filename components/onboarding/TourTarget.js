'use client';

import { cn } from '../../lib/utils';

/**
 * Envelope opcional para marcar um alvo do tutorial (`data-tour-id`).
 * O spotlight usa document.querySelector('[data-tour-id="…"]').
 *
 * @example
 * <TourTarget id="dashboard-missions">
 *   <DashboardMissionsProgress … />
 * </TourTarget>
 */
export function TourTarget({ id, className, children, as: Tag = 'div' }) {
  const Comp = Tag;
  return (
    <Comp className={cn(className)} data-tour-id={id}>
      {children}
    </Comp>
  );
}
