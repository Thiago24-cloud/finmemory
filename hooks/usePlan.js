import { useSession } from 'next-auth/react';
import { getEffectivePlan, canAccessFeature } from '../lib/planAccess';

/**
 * Hook de conveniência para verificar o plano do utilizador.
 * `refresh()` chama update() do NextAuth para re-sincronizar o plano do DB sem re-login.
 */
export function usePlan() {
  const { data: session, status, update } = useSession();
  const plan = getEffectivePlan(session);
  return {
    plan,
    isPaid: plan !== 'free',
    isPlus: planRank(plan) >= 1,
    isPro: planRank(plan) >= 2,
    isFamilia: plan === 'familia',
    can: (feature) => canAccessFeature(plan, feature),
    refresh: update,
    loading: status === 'loading',
  };
}

function planRank(p) {
  return { free: 0, plus: 1, pro: 2, familia: 3 }[p] ?? 0;
}
