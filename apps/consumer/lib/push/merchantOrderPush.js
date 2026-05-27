import { sendOneSignalToUsers, isOneSignalConfigured } from './oneSignalSend';
import { PEDIDO_STATUS } from '../merchant/pedidos/pedidoStatus';

function consumerAppBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    process.env.NEXTAUTH_URL?.replace(/\/$/, '') ||
    'https://finmemory.com.br'
  );
}

function retailerAppBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_RETAILER_APP_URL?.replace(/\/$/, '') ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    process.env.NEXTAUTH_URL?.replace(/\/$/, '') ||
    'https://parceiros.finmemory.com.br'
  );
}

function formatBrl(value) {
  return Number(value).toFixed(2).replace('.', ',');
}

/**
 * Donos / equipe da loja que recebem push de novo pedido.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} lojaId
 */
export async function resolveMerchantUserIdsForStore(supabase, lojaId) {
  const ids = new Set();

  const { data: store } = await supabase
    .from('stores')
    .select('owner_user_id')
    .eq('id', lojaId)
    .maybeSingle();

  if (store?.owner_user_id) ids.add(store.owner_user_id);

  const { data: membros, error: ulErr } = await supabase
    .from('usuarios_loja')
    .select('usuario_id')
    .eq('loja_id', lojaId);

  if (!ulErr) {
    for (const row of membros || []) {
      if (row?.usuario_id) ids.add(row.usuario_id);
    }
  }

  return [...ids];
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{
 *   pedido: { id: string, total?: number },
 *   storeName: string,
 *   lojaId: string,
 * }} payload
 */
export async function notifyMerchantNewOrder(supabase, payload) {
  const { pedido, storeName, lojaId } = payload;
  const merchantIds = await resolveMerchantUserIdsForStore(supabase, lojaId);
  if (merchantIds.length === 0) {
    return { ok: true, skipped: true, reason: 'no_merchant_users', sent: 0 };
  }

  const total = formatBrl(pedido.total ?? 0);
  const store = String(storeName || 'sua loja').trim();

  return sendOneSignalToUsers(merchantIds, {
    title: 'Novo pedido para retirada 🛒',
    body: `Pedido de R$ ${total} na ${store}. Abra o painel para começar o preparo.`,
    url: `${retailerAppBaseUrl()}/parceiros/painel`,
  });
}

/**
 * @param {{
 *   pedidoId: string,
 *   status: string,
 *   storeName?: string,
 *   clienteUserId: string,
 *   etaPrevistoEm?: string | null,
 * }} payload
 */
export function buildClientePedidoStatusPushCopy(payload) {
  const store = String(payload.storeName || 'a loja').trim();
  const eta =
    payload.etaPrevistoEm && payload.status === PEDIDO_STATUS.PREPARANDO
      ? new Date(payload.etaPrevistoEm).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : null;

  switch (payload.status) {
    case PEDIDO_STATUS.PREPARANDO:
      return {
        title: 'Seu pedido está sendo preparado 👨‍🍳',
        body: eta
          ? `${store} começou o preparo. Previsão de retirada por volta das ${eta}.`
          : `${store} começou a preparar seu pedido.`,
      };
    case PEDIDO_STATUS.PRONTO:
      return {
        title: 'Pedido pronto para retirada ✅',
        body: `Pode buscar na ${store}. Mostre o código na tela de acompanhamento.`,
      };
    case PEDIDO_STATUS.CONCLUIDO:
      return {
        title: 'Pedido retirado — obrigado!',
        body: `Esperamos que tenha gostado. Até a próxima na ${store}.`,
      };
    case PEDIDO_STATUS.CANCELADO:
      return {
        title: 'Pedido cancelado',
        body: `${store} cancelou o pedido. Toque para ver detalhes.`,
      };
    default:
      return null;
  }
}

/**
 * @param {{
 *   pedidoId: string,
 *   status: string,
 *   storeName?: string,
 *   clienteUserId: string,
 *   etaPrevistoEm?: string | null,
 * }} payload
 */
export async function notifyClientePedidoStatus(payload) {
  const copy = buildClientePedidoStatusPushCopy(payload);
  if (!copy) {
    return { ok: true, skipped: true, reason: 'status_without_push', sent: 0 };
  }

  return sendOneSignalToUsers([payload.clienteUserId], {
    title: copy.title,
    body: copy.body,
    url: `${consumerAppBaseUrl()}/pedido/${payload.pedidoId}`,
  });
}

export { isOneSignalConfigured };
