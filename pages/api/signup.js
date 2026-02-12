import { createClient } from '@supabase/supabase-js';

let supabaseInstance = null;

function getSupabase() {
  if (!supabaseInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    supabaseInstance = createClient(url, key);
  }
  return supabaseInstance;
}

function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) && trimmed.length <= 255;
}

/**
 * POST /api/signup
 * Body: { email: string }
 * Cadastra email na lista; se aprovado (default), usuário pode acessar o app.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(500).json({ error: 'Configuração indisponível' });
  }

  const { email } = req.body || {};
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Informe um e-mail válido' });
  }

  const normalized = email.trim().toLowerCase();

  try {
    const { error } = await supabase
      .from('signups')
      .insert({ email: normalized, approved: true });

    if (error) {
      if (error.code === '23505') {
        return res.status(200).json({ success: true, alreadyRegistered: true, approved: true, message: 'E-mail já cadastrado.' });
      }
      console.error('Signup error:', error);
      return res.status(500).json({ error: error.message || 'Erro ao cadastrar' });
    }

    return res.status(201).json({
      success: true,
      approved: true,
      message: 'Cadastro feito! Redirecionando ao mapa.',
    });
  } catch (e) {
    console.error('Signup exception:', e);
    return res.status(500).json({ error: 'Erro ao cadastrar' });
  }
}
