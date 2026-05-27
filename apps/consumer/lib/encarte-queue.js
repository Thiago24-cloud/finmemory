import { getSupabaseAdmin } from './supabaseAdmin';

/**
 * Enfileira imagem de encarte para extração em lote (POST /api/encarte/extract).
 *
 * @param {{ storeId: string, imageUrl: string, source?: 'scraper' | 'instagram' | 'manual' }} p
 */
export async function enqueueEncarte({ storeId, imageUrl, source = 'manual' }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error('Supabase admin não configurado (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)');
  }
  const sid = storeId != null ? String(storeId).trim() : '';
  const url = imageUrl != null ? String(imageUrl).trim() : '';
  if (!sid) throw new Error('storeId é obrigatório');
  if (!url) throw new Error('imageUrl é obrigatório');

  const { data, error } = await supabase
    .from('encarte_queue')
    .insert({ store_id: sid, image_url: url, source: source || 'manual' })
    .select()
    .single();

  if (error) throw error;
  return data;
}
