/**
 * POST /api/parceiros/adm/whatsapp-quote
 * Body: { text?, address?, items?, phone?, radius_km?, customer_name? }
 * Cola mensagem WhatsApp → geocode → preços do mapa → mensagem de resposta.
 */
import { requireAdmCompraApi } from '../../../../lib/adm/admCompra';
import { runAdmMapQuote } from '../../../../lib/adm/runAdmMapQuote';
import {
  parseWhatsappQuotePaste,
  normalizeWhatsAppDigitsLoose,
} from '../../../../lib/adm/whatsappQuote';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ctx = await requireAdmCompraApi(req, res);
  if (!ctx) return;
  const { supabase } = ctx;

  const body = req.body || {};
  const pasted = String(body.text || body.paste || '').trim();
  const parsed = pasted
    ? parseWhatsappQuotePaste(pasted)
    : { address: null, phone_digits: null, items: [] };

  const address = String(body.address || parsed.address || '').trim() || null;
  const itemsRaw = Array.isArray(body.items) ? body.items : parsed.items;
  const items = itemsRaw
    .map((s) => String(s || '').trim())
    .filter((n) => n.length >= 2)
    .slice(0, 40);

  const phoneDigits =
    normalizeWhatsAppDigitsLoose(body.phone || body.telefone || '') ||
    parsed.phone_digits ||
    null;

  const radiusKm = Math.min(25, Math.max(2, Number(body.radius_km) || 8));
  const customerName = String(body.customer_name || body.nome || '').trim() || null;

  if (items.length === 0) {
    return res.status(400).json({
      error: 'Nenhum item de lista encontrado. Cole endereço + lista ou informe os produtos.',
      parsed,
    });
  }

  const result = await runAdmMapQuote({
    supabase,
    items,
    address,
    phone: phoneDigits,
    customerName,
    radiusKm,
  });

  if (result.error) {
    return res.status(result.status || 500).json({ error: result.error, parsed });
  }

  return res.status(200).json(result.payload);
}
