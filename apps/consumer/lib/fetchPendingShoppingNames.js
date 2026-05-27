import { getSupabase } from './supabase';

/**
 * Nomes dos itens da lista de compras ainda não marcados como comprados
 * (lista pessoal + parceria ativa), mesmo critério que /shopping-list.
 */
export async function fetchPendingShoppingProductNames(userId) {
  if (!userId) return [];
  const supabase = getSupabase();
  if (!supabase) return [];

  let activePartnership = null;
  const { data: memberRow } = await supabase
    .from('partnership_members')
    .select('partnership_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (memberRow) {
    const { data: p } = await supabase
      .from('partnerships')
      .select('id')
      .eq('id', memberRow.partnership_id)
      .eq('status', 'active')
      .maybeSingle();
    if (p) activePartnership = p;
  }

  const { data: personal } = await supabase
    .from('shopping_list_items')
    .select('name, checked')
    .eq('owner_user_id', userId)
    .is('partnership_id', null)
    .order('created_at', { ascending: false });

  let shared = [];
  if (activePartnership) {
    const { data: s } = await supabase
      .from('shopping_list_items')
      .select('name, checked')
      .eq('partnership_id', activePartnership.id)
      .order('created_at', { ascending: false });
    shared = s || [];
  }

  const merged = [...(personal || []), ...shared];
  return merged
    .filter((i) => !i.checked)
    .map((i) => String(i.name || '').trim())
    .filter(Boolean);
}
