import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * Se PLUGGY_WEBHOOK_SECRET estiver definido, exige um dos:
 * - header X-Pluggy-Webhook-Secret
 * - Authorization: Bearer <secret>
 * - query ?secret= (útil só para testes manuais)
 *
 * No dashboard Pluggy (só URL), crie o webhook pela API com `headers` ou deixe o segredo vazio em dev.
 */
function verifyWebhookSecret(req) {
  const secret = process.env.PLUGGY_WEBHOOK_SECRET?.trim();
  if (!secret) return true;

  const headerSecret =
    (typeof req.headers['x-pluggy-webhook-secret'] === 'string' &&
      req.headers['x-pluggy-webhook-secret']) ||
    '';
  const auth = req.headers.authorization;
  const bearer =
    typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const querySecret = typeof req.query?.secret === 'string' ? req.query.secret : '';

  const provided = headerSecret || bearer || querySecret;
  return provided === secret;
}

/** @param {import('@supabase/supabase-js').SupabaseClient} supabase */
async function resolveUserIdFromClientUserId(supabase, clientUserId) {
  if (!clientUserId || typeof clientUserId !== 'string') return null;
  const trimmed = clientUserId.trim();
  if (!trimmed) return null;

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed)) {
    const { data } = await supabase.from('users').select('id').eq('id', trimmed).maybeSingle();
    return data?.id ?? null;
  }

  const { data } = await supabase.from('users').select('id').eq('email', trimmed).maybeSingle();
  return data?.id ?? null;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Record<string, unknown>} body
 */
async function processWebhookBody(supabase, body) {
  const event = typeof body.event === 'string' ? body.event : '';
  const itemId = typeof body.itemId === 'string' ? body.itemId : null;
  const clientUserId = typeof body.clientUserId === 'string' ? body.clientUserId : null;

  if (event === 'item/deleted' && itemId) {
    const { error } = await supabase.from('bank_connections').delete().eq('item_id', itemId);
    if (error) console.warn('[pluggy/webhook] item/deleted delete:', error.message);
    return;
  }

  if (
    (event === 'item/created' || event === 'item/updated' || event === 'item/login_succeeded') &&
    itemId &&
    clientUserId
  ) {
    const userId = await resolveUserIdFromClientUserId(supabase, clientUserId);
    if (!userId) {
      console.warn('[pluggy/webhook] utilizador não encontrado para clientUserId:', clientUserId);
      return;
    }
    const { error } = await supabase.from('bank_connections').upsert(
      { user_id: userId, item_id: itemId },
      { onConflict: 'user_id,item_id' }
    );
    if (error) console.warn('[pluggy/webhook] upsert bank_connections:', error.message);
    return;
  }

  if (event.startsWith('transactions/')) {
    console.info('[pluggy/webhook]', event, {
      eventId: body.eventId,
      itemId: body.itemId,
      accountId: body.accountId,
    });
  }
}

/**
 * POST /api/pluggy/webhook — notificações Pluggy (Open Finance).
 * GET — confirma que a URL está acessível (útil antes de registar no dashboard).
 *
 * @see https://docs.pluggy.ai/docs/webhooks
 */
export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      message: 'Webhook Pluggy: use POST. Registe este URL no dashboard (HTTPS, não localhost).',
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!verifyWebhookSecret(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : null;
  const hasEvent = Boolean(body && typeof body.event === 'string' && body.event.trim());

  /** Ping / validação ao registar o URL no dashboard: corpo vazio ou sem event → 2xx obrigatório. */
  if (!hasEvent) {
    return res.status(200).json({ ok: true, received: true });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.error('[pluggy/webhook] Supabase admin não configurado');
    return res.status(500).json({ error: 'Configuração do servidor incompleta' });
  }

  try {
    await processWebhookBody(supabase, body);
  } catch (e) {
    console.error('[pluggy/webhook] process:', body.event, e?.message || e);
  }

  return res.status(200).json({ received: true });
}
