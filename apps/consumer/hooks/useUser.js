import { useSession } from 'next-auth/react';

/**
 * Retorna o usuário atual no formato usado pelo Analytics (id Supabase + created_at).
 * user = null enquanto loading ou não logado.
 */
export function useUser() {
  const { data: session, status } = useSession();
  const loading = status === 'loading';

  const user =
    session?.user?.supabaseId != null
      ? {
          id: session.user.supabaseId,
          created_at: session.user.created_at || null
        }
      : null;

  return { user, loading };
}
