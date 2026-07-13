/** GET /api/parceiros/pedir/menu?loja=uuid — cardápio público (QR mesa). */
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { mapProdutoRowToApi } from '../../../../lib/merchant/mapProdutoRow';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const lojaId = String(req.query.loja || '').trim();
  if (!lojaId) {
    return res.status(400).json({ error: 'Parâmetro loja obrigatório.' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Serviço indisponível' });
  }

  const { data: store, error: storeErr } = await supabase
    .from('stores')
    .select('id, name, address')
    .eq('id', lojaId)
    .maybeSingle();

  if (storeErr) return res.status(500).json({ error: storeErr.message });
  if (!store) return res.status(404).json({ error: 'Loja não encontrada.' });

  const { data: products, error: prodErr } = await supabase
    .from('produtos_loja')
    .select(
      'id, loja_id, nome, descricao, preco_original, preco_oferta, em_oferta, quantidade_estoque, url_imagem, status_disponivel'
    )
    .eq('loja_id', lojaId)
    .eq('status_disponivel', true)
    .order('nome', { ascending: true })
    .limit(100);

  if (prodErr) {
    return res.status(500).json({ error: prodErr.message });
  }

  const mapped = (products || []).map((row) => {
    const api = mapProdutoRowToApi(row);
    const oferta = Number(row.preco_oferta);
    const original = Number(row.preco_original);
    const effective =
      row.em_oferta && Number.isFinite(oferta) && oferta > 0
        ? oferta
        : Number.isFinite(original) && original > 0
          ? original
          : oferta;
    return { ...api, price: effective };
  });

  return res.status(200).json({
    store: { id: store.id, name: store.name, address: store.address || null },
    mesa: req.query.mesa ? String(req.query.mesa) : null,
    products: mapped,
  });
}
