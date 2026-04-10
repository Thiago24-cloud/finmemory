import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

async function resolveAppUserId(session, supabase) {
  let userId = session?.user?.supabaseId;
  if (userId) return userId;
  const email = session?.user?.email;
  if (!email || !supabase) return null;
  const { data, error } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
  if (error || !data?.id) return null;
  return data.id;
}

function isMissingOnboardingColumn(error) {
  const m = String(error?.message || '').toLowerCase();
  return (
    m.includes('onboarding_dashboard_completed_at') ||
    (m.includes('column') && m.includes('does not exist')) ||
    m.includes('schema cache')
  );
}

/**
 * GET  /api/user/onboarding → { showTour: boolean }
 * POST /api/user/onboarding → marca tour como concluído
 */
export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email && !session?.user?.supabaseId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Configuração do servidor incompleta' });
  }

  const userId = await resolveAppUserId(session, supabase);
  if (!userId) {
    return res.status(401).json({ error: 'Utilizador não encontrado' });
  }

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('users')
      .select('onboarding_dashboard_completed_at')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      if (isMissingOnboardingColumn(error)) {
        // Coluna ainda não criada no Supabase — app mostra tour; cliente pode usar localStorage.
        return res.status(200).json({ showTour: true, reason: 'column_missing' });
      }
      console.error('[onboarding GET]', error.message);
      return res.status(500).json({ error: error.message });
    }

    const showTour = !data?.onboarding_dashboard_completed_at;
    return res.status(200).json({ showTour });
  }

  if (req.method === 'POST') {
    const { error } = await supabase
      .from('users')
      .update({ onboarding_dashboard_completed_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      if (isMissingOnboardingColumn(error)) {
        return res.status(200).json({ ok: true, saved: false, reason: 'column_missing' });
      }
      console.error('[onboarding POST]', error.message);
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ ok: true, saved: true });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
