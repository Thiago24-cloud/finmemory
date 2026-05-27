import { getSupabase } from './supabase';

/**
 * Itens pendentes da lista (pessoal + parceria) com id e nome — para cruzar com o mapa.
 */
export async function fetchPendingShoppingItems(userId) {
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
    .select('id, name, checked, source_type, shopping_intent')
    .eq('owner_user_id', userId)
    .is('partnership_id', null)
    .order('created_at', { ascending: false });

  let shared = [];
  if (activePartnership) {
    const { data: s } = await supabase
      .from('shopping_list_items')
      .select('id, name, checked, source_type, shopping_intent')
      .eq('partnership_id', activePartnership.id)
      .order('created_at', { ascending: false });
    shared = s || [];
  }

  const merged = [...(personal || []), ...shared];
  const seen = new Set();

  return merged
    .filter(
      (i) =>
        !i.checked &&
        i.source_type !== 'map' &&
        i.shopping_intent !== 'saved_deferred'
    )
    .map((i) => ({
      id: i.id,
      name: String(i.name || '').trim(),
    }))
    .filter((i) => {
      if (i.name.length < 2) return false;
      const key = i.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
