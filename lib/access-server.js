import { createClient } from '@supabase/supabase-js';

let supabaseServerInstance = null;

function getSupabaseServer() {
  if (!supabaseServerInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    supabaseServerInstance = createClient(url, key);
  }
  return supabaseServerInstance;
}

/**
 * Verifica se o e-mail está cadastrado e aprovado (pode acessar o app).
 * Usar apenas no servidor (getServerSideProps, API routes).
 * Em produção, configure SUPABASE_SERVICE_ROLE_KEY no Cloud Run para leitura confiável.
 */
export async function canAccess(email) {
  if (!email || typeof email !== 'string') return false;
  const normalized = email.trim().toLowerCase();
  const supabase = getSupabaseServer();
  if (!supabase) {
    console.warn('[canAccess] Supabase não configurado no servidor');
    return false;
  }
  const { data, error } = await supabase
    .from('signups')
    .select('id')
    .eq('email', normalized)
    .eq('approved', true)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn('[canAccess] Erro ao ler signups:', error.message, '| email:', normalized);
    return false;
  }
  return data != null;
}
