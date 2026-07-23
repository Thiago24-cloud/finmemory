import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { getStoreFeatureAccess, unlockPlanNameForFeature } from '../../../../lib/loja/storePlanAccess';

const ALLOWED = new Set([
  'qr_code_scanned',
  'public_page_viewed',
  'customer_registered',
  'whatsapp_clicked',
  'order_started',
]);

/**
 * POST /api/loja/[slug]/events
 * Body: { event_type, meta? }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const slug = String(req.query.slug || '').trim().toLowerCase();
  const eventType = String(req.body?.event_type || req.body?.eventType || '').trim();
  const meta = req.body?.meta && typeof req.body.meta === 'object' ? req.body.meta : {};

  if (!slug) return res.status(400).json({ error: 'Slug obrigatório.' });
  if (!ALLOWED.has(eventType)) {
    return res.status(400).json({ error: 'event_type inválido.' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Serviço indisponível' });

  const { data: store, error: storeErr } = await supabase
    .from('stores')
    .select('id, public_slug')
    .eq('public_slug', slug)
    .maybeSingle();

  if (storeErr) {
    if (/public_slug|store_public_events/i.test(storeErr.message || '')) {
      return res.status(503).json({ error: 'Schema da página pública ausente.', code: 'MISSING_SCHEMA' });
    }
    return res.status(500).json({ error: storeErr.message });
  }
  if (!store) return res.status(404).json({ error: 'Loja não encontrada.' });

  const access = await getStoreFeatureAccess(supabase, store.id);
  if (!access.can('public_store_page')) {
    return res.status(403).json({
      code: 'FEATURE_LOCKED',
      error: `Essa funcionalidade está disponível no plano ${unlockPlanNameForFeature('public_store_page')}.`,
    });
  }

  const { error: insErr } = await supabase.from('store_public_events').insert({
    store_id: store.id,
    event_type: eventType,
    meta,
  });

  if (insErr) {
    if (/store_public_events/i.test(insErr.message || '')) {
      return res.status(503).json({ error: 'Tabela de eventos ausente.', code: 'MISSING_SCHEMA' });
    }
    return res.status(500).json({ error: insErr.message });
  }

  return res.status(201).json({ ok: true, event_type: eventType });
}
