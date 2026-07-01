/** Base das APIs do painel (/parceiros/painel). Usa public.produtos_loja no backend. */
export const PAINEL_API_BASE = '/api/parceiros/painel';

export const painelApi = {
  context: `${PAINEL_API_BASE}/context`,
  products: `${PAINEL_API_BASE}/products`,
  mapStatus: `${PAINEL_API_BASE}/map/status`,
  mapPublishBatch: `${PAINEL_API_BASE}/map/publish-batch`,
  pedidos: `${PAINEL_API_BASE}/pedidos`,
  pedido: (id) => `${PAINEL_API_BASE}/pedidos/${id}`,
  repairLink: `${PAINEL_API_BASE}/repair-link`,
  product: (id) => `${PAINEL_API_BASE}/products/${id}`,
  uploadImage: `${PAINEL_API_BASE}/products/upload-image`,
  stripeStatus: `${PAINEL_API_BASE}/stripe/status`,
  stripeConnect: `${PAINEL_API_BASE}/stripe/connect`,
  insumos: `${PAINEL_API_BASE}/insumos`,
  insumo: (id) => `${PAINEL_API_BASE}/insumos/${id}`,
  insumosImportValidate: `${PAINEL_API_BASE}/insumos/import/validate`,
  insumosImportConfirm: `${PAINEL_API_BASE}/insumos/import/confirm`,
  insumosImportApprove: `${PAINEL_API_BASE}/insumos/import/approve`,
  notasEntrada: `${PAINEL_API_BASE}/notas-entrada`,
  notasEntradaProcessImage: `${PAINEL_API_BASE}/notas-entrada/process-image`,
  notasEntradaFetchNfce: `${PAINEL_API_BASE}/notas-entrada/fetch-nfce`,
  notasEntradaConfirm: `${PAINEL_API_BASE}/notas-entrada/confirm`,
  estoqueScan: `${PAINEL_API_BASE}/estoque/scan`,
  estoqueDetect: `${PAINEL_API_BASE}/estoque/detect`,
  listaComprasCompare: `${PAINEL_API_BASE}/lista-compras/compare`,
  vendas: `${PAINEL_API_BASE}/vendas`,
  vendasResumo: `${PAINEL_API_BASE}/vendas/resumo`,
  paymentsStatus: `${PAINEL_API_BASE}/payments/status`,
  paymentsSimulate: `${PAINEL_API_BASE}/payments/simulate`,
  paymentsWebhook: `${PAINEL_API_BASE}/payments/webhook`,
};

/** POST pedido retirada (consumidor logado). */
export const PEDIDOS_API = '/api/parceiros/pedidos';
export const PEDIDOS_CHECKOUT_API = '/api/parceiros/pedidos/checkout';
export const pedidoTrackApi = (id) => `/api/parceiros/pedidos/${id}`;
