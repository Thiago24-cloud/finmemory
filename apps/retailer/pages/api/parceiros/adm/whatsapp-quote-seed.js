/**
 * POST /api/parceiros/adm/whatsapp-quote-seed
 * Carrega demo SP (cesta básica + logos/cache) para testar o orçamento WhatsApp.
 */
import { requireAdmCompraApi } from '../../../../lib/adm/admCompra';
import { seedWhatsappQuoteDemo } from '../../../../lib/adm/seedWhatsappQuoteDemo';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ctx = await requireAdmCompraApi(req, res);
  if (!ctx) return;

  const result = await seedWhatsappQuoteDemo(ctx.supabase);
  if (!result.ok) {
    return res.status(500).json({ error: result.error || 'Falha ao carregar demo.' });
  }

  return res.status(200).json(result);
}
