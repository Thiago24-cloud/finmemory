import { createClient } from '@supabase/supabase-js';

let supabaseInstance = null;

/**
 * Retorna o cliente Supabase (lazy, apenas no browser).
 */
export function getSupabase() {
  if (typeof window === 'undefined') return null;
  if (!supabaseInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    supabaseInstance = createClient(url, key);
  }
  return supabaseInstance;
}
