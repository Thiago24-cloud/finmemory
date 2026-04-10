import { createClient } from '@supabase/supabase-js';
import { pluggyWebhookSecret } from '../../../lib/pluggyEnv';
import { createPluggyServerClient, syncTransactionsForItem } from '../../../lib/pluggySyncTransactions';
import { syncOpenFinanceForItem } from '../../../lib/pluggySyncOpenFinance';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * PLUGGY_WEBHOOK_SECRET vazio → aceita POST (útil em dev; não recomendado em produção).
 * Caso contrário, basta um dos headers/query coincidir com o segredo (qualquer ordem).
 *
 * Headers típicos (Pluggy permite custom headers via API):
 * - X-Pluggy-Signature, X-Pluggy-Webhook-Secret, Authorization: Bearer
 *
 * @see https://docs.pluggy.ai/docs/webhooks
 */
/**
 * @returns {{ ok: true } | { ok: false, debug: Record<string, unknown> }}
 */
function verifyWebhookSecret(req) {
  const secret = pluggyWebhookSecret();
  if (!secret) return { ok: true };

  const pick = (name) =>
    typeof req.headers[name] === 'string' ? req.headers[name].trim() : '';

  const auth = req.headers.authorization;
  const bearer =
    typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const querySecret =
    typeof req.query?.secret === 'string' ? String(req.query.secret).trim() : '';

  const sig = pick('x-pluggy-signature');
  const headerSecret = pick('x-pluggy-webhook-secret');

  const candidates = [sig, headerSecret, bearer, querySecret].filter(Boolean);

  if (candidates.some((c) => c === secret)) return { ok: true };

  const body = req.body && typeof req.body === 'object' ? req.body : null;
  const event = body && typeof body.event === 'string' ? body.event : undefined;

  return {
    ok: false,
    debug: {
      event,
      hasXPluggySignature: Boolean(sig),
      hasXPluggyWebhookSecret: Boolean(headerSecret),
      hasAuthorizationBearer: Boolean(bearer),
      hasQuerySecret: Boolean(querySecret),
    },
  };
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

/** Payload oficial Pluggy usa itemId; defesa extra se vier item aninhado. */
function resolveItemId(body) {
  if (typeof body.itemId === 'string' && body.itemId.trim()) return body.itemId.trim();
  const item = body.item;
  if (item && typeof item === 'object' && typeof item.id === 'string' && item.id.trim()) {
    return item.id.trim();
  }
  return null;
}

/** Sincroniza transações quando já existe bank_connections (ex.: webhooks transactions/*). */
async function runPluggyTransactionSync(supabase, itemId) {
  if (!itemId) return;
  const { data: bc } = await supabase
    .from('bank_connections')
    .select('user_id')
    .eq('item_id', itemId)
    .maybeSingle();
  if (!bc?.user_id) return;
  const pluggy = createPluggyServerClient();
  if (!pluggy) return;
  try {
    const [rTx, rOf] = await Promise.all([
      syncTransactionsForItem(supabase, pluggy, bc.user_id, itemId),
      syncOpenFinanceForItem(supabase, pluggy, bc.user_id, itemId),
    ]);
    console.info('[pluggy/webhook] sync', itemId, { transacoes: rTx, openFinance: rOf });
  } catch (e) {
    console.warn('[pluggy/webhook] sync falhou', itemId, e?.message || e);
  }
}

function nowIso() {
  return new Date().toISOString();
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Record<string, unknown>} body
 */
async function processWebhookBody(supabase, body) {
  const event = typeof body.event === 'string' ? body.event : '';
  const itemId = resolveItemId(body);
  const clientUserId = typeof body.clientUserId === 'string' ? body.clientUserId : null;

  console.log('[pluggy/webhook] evento:', event, itemId ? `itemId=${itemId}` : '');

  switch (event) {
    case 'item/deleted':
      if (itemId) {
        const { error: delAccErr } = await supabase.from('bank_accounts').delete().eq('item_id', itemId);
        if (delAccErr) console.warn('[pluggy/webhook] item/deleted bank_accounts:', delAccErr.message);
        const { error } = await supabase.from('bank_connections').delete().eq('item_id', itemId);
        if (error) console.warn('[pluggy/webhook] item/deleted:', error.message);
      }
      return;

    case 'item/error': {
      if (!itemId) return;
      const err = body.error && typeof body.error === 'object' ? body.error : null;
      const code = err?.code != null ? String(err.code) : null;
      console.warn('[pluggy/webhook] item/error', itemId, code, err?.message);
      const { error } = await supabase
        .from('bank_connections')
        .update({
          status: 'error',
          error_code: code,
          updated_at: nowIso(),
        })
        .eq('item_id', itemId);
      if (error) console.warn('[pluggy/webhook] item/error update:', error.message);
      return;
    }

    case 'item/waiting_user_input':
      if (itemId) {
        console.info('[pluggy/webhook] aguardando input do utilizador:', itemId);
        const { error } = await supabase
          .from('bank_connections')
          .update({ status: 'waiting_user_input', updated_at: nowIso() })
          .eq('item_id', itemId);
        if (error) console.warn('[pluggy/webhook] waiting_user_input:', error.message);
      }
      return;

    case 'item/created':
    case 'item/updated':
    case 'item/login_succeeded':
      if (!itemId || !clientUserId) return;
      {
        const userId = await resolveUserIdFromClientUserId(supabase, clientUserId);
        if (!userId) {
          console.warn('[pluggy/webhook] utilizador não encontrado para clientUserId:', clientUserId);
          return;
        }
        const { error } = await supabase.from('bank_connections').upsert(
          {
            user_id: userId,
            item_id: itemId,
            status: 'connected',
            error_code: null,
            updated_at: nowIso(),
          },
          { onConflict: 'user_id,item_id' }
        );
        if (error) console.warn('[pluggy/webhook] upsert bank_connections:', error.message);
        else await runPluggyTransactionSync(supabase, itemId);
      }
      return;

    default:
      if (event.startsWith('transactions/')) {
        console.info('[pluggy/webhook]', event, {
          eventId: body.eventId,
          itemId: body.itemId,
          accountId: body.accountId,
        });
        if (itemId) await runPluggyTransactionSync(supabase, itemId);
        return;
      }
      if (event) console.log('[pluggy/webhook] evento não tratado:', event);
  }
}

/**
 * POST /api/pluggy/webhook — notificações Pluggy (Open Finance).
 * GET — confirma que a URL está acessível.
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

  const authResult = verifyWebhookSecret(req);
  if (!authResult.ok) {
    console.warn('[pluggy/webhook] segredo inválido', authResult.debug);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : null;
  const hasEvent = Boolean(body && typeof body.event === 'string' && body.event.trim());

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
    // Responder 2xx mesmo assim: a Pluggy reenvia em caso de erro HTTP (até 9x).
    console.error('[pluggy/webhook] erro interno:', body.event, e?.message || e);
  }

  return res.status(200).json({ ok: true, received: true });
}
