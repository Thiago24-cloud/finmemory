import { requireMerchantApi } from '../../../../lib/merchant/requireMerchantApi';
import {
  runPriceDropAlertsForStore,
  whatsappShareUrl,
} from '../../../../lib/merchant/alertas/priceDropAlerts';

/**
 * GET  — lista alertas atuais (check leve)
 * POST — { action: 'enable'|'disable'|'check', insumoId? }
 */
export default async function handler(req, res) {
  const ctx = await requireMerchantApi(req, res);
  if (!ctx) return;

  if (req.method === 'GET' || (req.method === 'POST' && req.body?.action === 'check')) {
    const notify =
      req.method === 'POST' &&
      (req.body?.notify === true || req.body?.notify === '1' || req.query.notify === '1');
    const result = await runPriceDropAlertsForStore(ctx.supabase, {
      userId: ctx.userId,
      lojaId: ctx.store.id,
      lat: ctx.store.lat,
      lng: ctx.store.lng,
      radiusKm: Number(req.query.radiusKm || req.body?.radiusKm) || 12,
      notify,
    });
    if (!result.ok) return res.status(500).json(result);
    return res.status(200).json({
      ...result,
      alerts: (result.alerts || []).map((a) => ({
        ...a,
        whatsappUrl: whatsappShareUrl(a.whatsappText),
      })),
    });
  }

  if (req.method === 'POST') {
    const action = String(req.body?.action || '').trim();
    const insumoId = String(req.body?.insumoId || '').trim();
    if (!insumoId) return res.status(400).json({ error: 'insumoId é obrigatório' });
    if (action !== 'enable' && action !== 'disable') {
      return res.status(400).json({ error: 'action inválida' });
    }

    const patch = { alerta_preco: action === 'enable', updated_at: new Date().toISOString() };
    const { error } = await ctx.supabase
      .from('insumos_loja')
      .update(patch)
      .eq('id', insumoId)
      .eq('loja_id', ctx.store.id);

    if (error) {
      if (/alerta_preco|column/i.test(error.message || '')) {
        return res.status(409).json({
          error: 'Execute a migration de alertas (alerta_preco em insumos_loja).',
          code: 'ALERTA_MIGRATION_REQUIRED',
        });
      }
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ ok: true, alerta_preco: action === 'enable' });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
