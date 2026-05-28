import { requireMerchantApi } from '../../../../lib/merchant/requireMerchantApi';
import { publishMerchantProductToMap } from '../../../../lib/merchant/publishMerchantProductToMap';

/**
 * POST /api/merchant/map/publish-batch
 * Body: { product_ids?: string[], only_flash_offer?: boolean, limit?: number }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await requireMerchantApi(req, res);
  if (!auth) return;

  const { supabase, userId, store } = auth;
  const body = req.body || {};
  const onlyFlash = body.only_flash_offer !== false;
  const limit = Math.min(200, Math.max(1, Number.parseInt(String(body.limit || 50), 10) || 50));
  const explicitIds = Array.isArray(body.product_ids)
    ? body.product_ids.map((id) => String(id || '').trim()).filter(Boolean)
    : [];

  let query = supabase
    .from('produtos_loja')
    .select(
      'id, nome, descricao, preco_oferta, em_oferta, status_disponivel, url_imagem, updated_at'
    )
    .eq('loja_id', store.id)
    .eq('status_disponivel', true)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (onlyFlash) {
    query = query.eq('em_oferta', true);
  }

  if (explicitIds.length > 0) {
    query = query.in('id', explicitIds);
  }

  const { data: products, error } = await query;
  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const rows = products || [];
  if (rows.length === 0) {
    return res.status(200).json({
      ok: true,
      total: 0,
      published: 0,
      failed: 0,
      skipped: 0,
      results: [],
    });
  }

  const results = [];
  let published = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows) {
    if (!Number.isFinite(Number(row.preco_oferta)) || Number(row.preco_oferta) < 0) {
      skipped += 1;
      results.push({
        product_id: row.id,
        name: row.nome,
        ok: false,
        skipped: true,
        reason: 'Preço inválido para publicação.',
      });
      continue;
    }

    const pub = await publishMerchantProductToMap(supabase, {
      store,
      userId,
      name: String(row.nome || '').trim() || 'Produto',
      price: Number(row.preco_oferta),
      imageUrl: row.url_imagem || null,
      description: row.descricao || null,
      flashOffer: Boolean(row.em_oferta),
      produtoLojaId: row.id,
    });

    if (pub.ok) {
      published += 1;
      results.push({
        product_id: row.id,
        name: row.nome,
        ok: true,
        valid_until: pub.validUntil || null,
      });
    } else {
      failed += 1;
      results.push({
        product_id: row.id,
        name: row.nome,
        ok: false,
        skipped: false,
        reason: pub.error || 'Erro ao publicar no mapa.',
      });
    }
  }

  return res.status(200).json({
    ok: true,
    total: rows.length,
    published,
    failed,
    skipped,
    results,
  });
}
