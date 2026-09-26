import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { getStoreFeatureAccess, unlockPlanNameForFeature } from '../../../../lib/loja/storePlanAccess';
import { normalizeWhatsappDigits } from '../../../../lib/loja/publicStore';

/**
 * POST /api/loja/[slug]/register
 * Body: { name, whatsapp }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const slug = String(req.query.slug || '').trim().toLowerCase();
  const name = String(req.body?.name || '').trim();
  const whatsappDigits = normalizeWhatsappDigits(req.body?.whatsapp || req.body?.phone || '');

  if (!slug) return res.status(400).json({ error: 'Slug obrigatório.' });
  if (name.length < 2) return res.status(400).json({ error: 'Informe seu nome.' });
  if (whatsappDigits.length < 12) {
    return res.status(400).json({ error: 'Informe um WhatsApp válido com DDD.' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Serviço indisponível' });

  const { data: store, error: storeErr } = await supabase
    .from('stores')
    .select('id')
    .eq('public_slug', slug)
    .maybeSingle();

  if (storeErr) {
    return res.status(500).json({ error: storeErr.message });
  }
  if (!store) return res.status(404).json({ error: 'Loja não encontrada.' });

  const access = await getStoreFeatureAccess(supabase, store.id);
  if (!access.can('customer_registration')) {
    return res.status(403).json({
      code: 'FEATURE_LOCKED',
      feature: 'customer_registration',
      error: `Essa funcionalidade está disponível no plano ${unlockPlanNameForFeature('customer_registration')}.`,
      required_plan_name: unlockPlanNameForFeature('customer_registration'),
    });
  }

  const now = new Date().toISOString();
  const { data: existing } = await supabase
    .from('restaurant_customers')
    .select('id, name, whatsapp_digits, user_id')
    .eq('store_id', store.id)
    .eq('whatsapp_digits', whatsappDigits)
    .maybeSingle();

  let customer;
  if (existing) {
    const { data: updated, error: updErr } = await supabase
      .from('restaurant_customers')
      .update({ name, updated_at: now })
      .eq('id', existing.id)
      .select('id, name, whatsapp_digits, user_id, created_at')
      .maybeSingle();
    if (updErr) return res.status(500).json({ error: updErr.message });
    customer = updated;
  } else {
    const { data: created, error: insErr } = await supabase
      .from('restaurant_customers')
      .insert({
        store_id: store.id,
        name,
        whatsapp_digits: whatsappDigits,
        updated_at: now,
      })
      .select('id, name, whatsapp_digits, user_id, created_at')
      .maybeSingle();

    if (insErr) {
      if (/restaurant_customers/i.test(insErr.message || '')) {
        return res.status(503).json({
          error: 'Tabela restaurant_customers ausente. Execute a migration 20260723120000.',
          code: 'MISSING_SCHEMA',
        });
      }
      return res.status(500).json({ error: insErr.message });
    }
    customer = created;
  }

  await supabase.from('store_public_events').insert({
    store_id: store.id,
    event_type: 'customer_registered',
    meta: {
      customer_id: customer?.id || null,
      linked_existing: Boolean(existing),
    },
  });

  return res.status(existing ? 200 : 201).json({
    ok: true,
    linked_existing: Boolean(existing),
    customer: {
      id: customer.id,
      name: customer.name,
      whatsapp_digits: customer.whatsapp_digits,
    },
  });
}
