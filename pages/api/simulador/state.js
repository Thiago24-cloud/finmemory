import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

const MAX_STATE_BYTES = 120_000;

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.supabaseId;
  if (!userId) {
    return res.status(401).json({ error: 'Não autenticado ou perfil incompleto.' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Configuração do servidor incompleta (Supabase).' });
  }

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('financial_simulator_state')
      .select('state, updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('[simulador/state GET]', error.message);
      return res.status(500).json({ error: 'Falha ao ler estado.' });
    }

    return res.status(200).json({
      ok: true,
      state: data?.state ?? null,
      updatedAt: data?.updated_at ?? null,
    });
  }

  if (req.method === 'PUT') {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({ error: 'JSON inválido.' });
      }
    }

    const state = body?.state;
    if (state == null || typeof state !== 'object' || Array.isArray(state)) {
      return res.status(400).json({ error: 'Campo "state" (objeto) é obrigatório.' });
    }

    const serialized = JSON.stringify(state);
    if (serialized.length > MAX_STATE_BYTES) {
      return res.status(400).json({ error: 'Estado demasiado grande.' });
    }

    const { error } = await supabase.from('financial_simulator_state').upsert(
      {
        user_id: userId,
        state,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

    if (error) {
      console.error('[simulador/state PUT]', error.message);
      return res.status(500).json({ error: 'Falha ao gravar estado.' });
    }

    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, PUT');
  return res.status(405).json({ error: 'Method not allowed' });
}
