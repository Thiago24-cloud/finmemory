import { createClient } from '@supabase/supabase-js';

let instance = null;

export function getSupabaseAdmin() {
  if (instance) return instance;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  instance = createClient(url, key);
  return instance;
}
