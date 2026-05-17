import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { groupMapOffersByListItems } from '../../../lib/shoppingListMapMatch';

/**
 * GET — cruza itens pendentes da lista com ofertas ativas no mapa.
 * Query opcional: ?names=arroz,feijão (senão usa lista do utilizador na BD).
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.supabaseId;
  if (!session?.user?.email || !userId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Serviço indisponível' });

  let listItems = [];

  const namesParam = typeof req.query.names === 'string' ? req.query.names : '';
  if (namesParam.trim()) {
    listItems = namesParam
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter((n) => n.length >= 2)
      .slice(0, 24)
      .map((name, i) => ({ id: `q-${i}`, name }));
  } else {
    let activePartnership = null;
    const { data: memberRow } = await supabase
      .from('partnership_members')
      .select('partnership_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    if (memberRow?.partnership_id) {
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

    const seen = new Set();
    for (const row of [...(personal || []), ...shared]) {
      if (row.checked || row.source_type === 'map' || row.shopping_intent === 'saved_deferred') continue;
      const name = String(row.name || '').trim();
      if (name.length < 2) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      listItems.push({ id: row.id, name });
      if (listItems.length >= 24) break;
    }
  }

  if (listItems.length === 0) {
    return res.status(200).json({
      summary: { total: 0, matched: 0, unmatched: 0, storesCount: 0 },
      items: [],
    });
  }

  const productNames = listItems.map((i) => i.name);
  const { data: rpcRows, error } = await supabase.rpc('buscar_lojas_por_produtos_lista', {
    produtos: productNames,
  });

  if (error) {
    console.warn('[map-matches]', error.message);
    return res.status(500).json({ error: 'Não foi possível buscar ofertas no mapa.' });
  }

  const result = groupMapOffersByListItems(listItems, rpcRows);
  return res.status(200).json(result);
}
