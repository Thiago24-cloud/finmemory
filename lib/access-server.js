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
 * Verifica se o e-mail pode acessar o app.
 * Acesso liberado se:
 *   - o email existe na tabela users (já logou com Google), OU
 *   - o email está em signups com approved = true.
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
  // Quem já está em users (logou com Google) pode acessar
  const { data: userRow, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('email', normalized)
    .limit(1)
    .maybeSingle();
  if (!userError && userRow) return true;
  if (userError) {
    console.warn('[canAccess] Erro ao ler users:', userError.message, '| email:', normalized);
  }
  // Fallback: signups aprovados (lista de espera / pré-cadastro)
  const { data: signupRow, error: signupError } = await supabase
    .from('signups')
    .select('id')
    .eq('email', normalized)
    .eq('approved', true)
    .limit(1)
    .maybeSingle();
  if (signupError) {
    console.warn('[canAccess] Erro ao ler signups:', signupError.message, '| email:', normalized);
    return false;
  }
  return signupRow != null;
}
