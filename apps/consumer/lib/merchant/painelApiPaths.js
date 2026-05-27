/** Base das APIs do painel (/parceiros/painel). Usa public.produtos_loja no backend. */
export const PAINEL_API_BASE = '/api/parceiros/painel';

export const painelApi = {
  context: `${PAINEL_API_BASE}/context`,
  products: `${PAINEL_API_BASE}/products`,
  pedidos: `${PAINEL_API_BASE}/pedidos`,
  pedido: (id) => `${PAINEL_API_BASE}/pedidos/${id}`,
  repairLink: `${PAINEL_API_BASE}/repair-link`,
  product: (id) => `${PAINEL_API_BASE}/products/${id}`,
  uploadImage: `${PAINEL_API_BASE}/products/upload-image`,
  stripeStatus: `${PAINEL_API_BASE}/stripe/status`,
  stripeConnect: `${PAINEL_API_BASE}/stripe/connect`,
};

/** POST pedido retirada (consumidor logado). */
export const PEDIDOS_API = '/api/parceiros/pedidos';
export const PEDIDOS_CHECKOUT_API = '/api/parceiros/pedidos/checkout';
export const pedidoTrackApi = (id) => `/api/parceiros/pedidos/${id}`;
