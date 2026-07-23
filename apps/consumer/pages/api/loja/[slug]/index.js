import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { getStoreFeatureAccess, unlockPlanNameForFeature } from '../../../../lib/loja/storePlanAccess';

/**
 * GET /api/loja/[slug] — página pública da loja (sem login).
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const slug = String(req.query.slug || '').trim().toLowerCase();
  if (!slug) {
    return res.status(400).json({ error: 'Slug obrigatório.' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Serviço indisponível' });
  }

  const { data: store, error: storeErr } = await supabase
    .from('stores')
    .select('id, name, address, phone, weekday_hours, photo_url, public_slug, active')
    .eq('public_slug', slug)
    .maybeSingle();

  if (storeErr) {
    if (/public_slug/i.test(storeErr.message || '')) {
      return res.status(503).json({
        error: 'Migration da página pública pendente. Execute 20260723120000_store_public_qr.sql.',
        code: 'MISSING_SCHEMA',
      });
    }
    return res.status(500).json({ error: storeErr.message });
  }

  if (!store) {
    return res.status(404).json({ error: 'Loja não encontrada.' });
  }

  const access = await getStoreFeatureAccess(supabase, store.id);

  if (!access.can('public_store_page')) {
    return res.status(403).json({
      code: 'FEATURE_LOCKED',
      feature: 'public_store_page',
      error: `Essa funcionalidade está disponível no plano ${unlockPlanNameForFeature('public_store_page')}.`,
      required_plan_name: unlockPlanNameForFeature('public_store_page'),
      plan_name: access.planName,
    });
  }

  const features = {
    public_store_page: true,
    digital_menu: access.can('digital_menu'),
    customer_registration: access.can('customer_registration'),
    direct_orders: access.can('direct_orders'),
    pickup_orders: access.can('pickup_orders'),
    local_delivery: access.can('local_delivery'),
  };

  let products = [];
  if (features.digital_menu) {
    const { data: rows, error: prodErr } = await supabase
      .from('produtos_loja')
      .select(
        'id, loja_id, nome, descricao, preco_original, preco_oferta, em_oferta, url_imagem, status_disponivel'
      )
      .eq('loja_id', store.id)
      .eq('status_disponivel', true)
      .order('nome', { ascending: true })
      .limit(100);

    if (prodErr) {
      console.warn('[api/loja] products', prodErr.message);
    } else {
      products = (rows || []).map((row) => {
        const oferta = Number(row.preco_oferta);
        const original = Number(row.preco_original);
        const price =
          row.em_oferta && Number.isFinite(oferta) && oferta > 0
            ? oferta
            : Number.isFinite(original) && original > 0
              ? original
              : oferta || 0;
        return {
          id: row.id,
          name: row.nome,
          description: row.descricao || null,
          price,
          image_url: row.url_imagem || null,
          em_oferta: Boolean(row.em_oferta),
        };
      });
    }
  }

  return res.status(200).json({
    store: {
      id: store.id,
      name: store.name,
      address: store.address || null,
      phone: store.phone || null,
      weekday_hours: store.weekday_hours || null,
      photo_url: store.photo_url || null,
      slug: store.public_slug || slug,
    },
    features,
    plan: {
      code: access.planCode,
      name: access.planName,
    },
    products,
    locked_digital_menu: !features.digital_menu
      ? {
          message: `Essa funcionalidade está disponível no plano ${unlockPlanNameForFeature('digital_menu')}.`,
          required_plan_name: unlockPlanNameForFeature('digital_menu'),
        }
      : null,
  });
}
