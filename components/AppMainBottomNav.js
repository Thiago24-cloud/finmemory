'use client';

import { useRouter } from 'next/router';
import { BottomNav } from './BottomNav';
import { showMainBottomNav } from '../lib/mainBottomNavRoutes';

/**
 * Instância única da barra inferior — evita flicker do FAB ao mudar de página.
 */
export default function AppMainBottomNav() {
  const router = useRouter();
  if (!showMainBottomNav(router.pathname || '')) return null;
  return <BottomNav />;
}
