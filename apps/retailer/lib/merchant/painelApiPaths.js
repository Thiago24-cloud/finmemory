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
  productResolveImage: (id) => `${PAINEL_API_BASE}/products/${id}/resolve-image`,
  catalogSync: `${PAINEL_API_BASE}/catalog/sync`,
  uploadImage: `${PAINEL_API_BASE}/products/upload-image`,
  stripeStatus: `${PAINEL_API_BASE}/stripe/status`,
  stripeConnect: `${PAINEL_API_BASE}/stripe/connect`,
  insumos: `${PAINEL_API_BASE}/insumos`,
  insumo: (id) => `${PAINEL_API_BASE}/insumos/${id}`,
  insumoResolveImage: (id) => `${PAINEL_API_BASE}/insumos/${id}/resolve-image`,
  insumoUploadImage: `${PAINEL_API_BASE}/insumos/upload-image`,
  insumosImportValidate: `${PAINEL_API_BASE}/insumos/import/validate`,
  insumosImportConfirm: `${PAINEL_API_BASE}/insumos/import/confirm`,
  insumosImportApprove: `${PAINEL_API_BASE}/insumos/import/approve`,
  notasEntrada: `${PAINEL_API_BASE}/notas-entrada`,
  notasEntradaProcessImage: `${PAINEL_API_BASE}/notas-entrada/process-image`,
  notasEntradaFetchNfce: `${PAINEL_API_BASE}/notas-entrada/fetch-nfce`,
  notasEntradaConfirm: `${PAINEL_API_BASE}/notas-entrada/confirm`,
  estoqueScan: `${PAINEL_API_BASE}/estoque/scan`,
  estoqueDetect: `${PAINEL_API_BASE}/estoque/detect`,
  cosmosBarcodeLookup: `${PAINEL_API_BASE}/catalog/cosmos/lookup`,
  listaComprasCompare: `${PAINEL_API_BASE}/lista-compras/compare`,
  comprasCesta: `${PAINEL_API_BASE}/compras/cesta`,
  comprasSimulate: `${PAINEL_API_BASE}/compras/simulate`,
  comprasMatch: `${PAINEL_API_BASE}/compras/match`,
  comprasPriceHistory: `${PAINEL_API_BASE}/compras/price-history`,
  alertas: `${PAINEL_API_BASE}/alertas`,
  vendas: `${PAINEL_API_BASE}/vendas`,
  vendasResumo: `${PAINEL_API_BASE}/vendas/resumo`,
  mapPrecosSearch: `${PAINEL_API_BASE}/map/precos-search`,
  mesas: `${PAINEL_API_BASE}/mesas`,
  mesa: (id) => `${PAINEL_API_BASE}/mesas/${id}`,
  caixaPagar: `${PAINEL_API_BASE}/caixa/pagar`,
  entregaConfig: `${PAINEL_API_BASE}/entrega/config`,
  preparo: `${PAINEL_API_BASE}/preparo`,
  paymentsStatus: `${PAINEL_API_BASE}/payments/status`,
  paymentsSimulate: `${PAINEL_API_BASE}/payments/simulate`,
  paymentsWebhook: `${PAINEL_API_BASE}/payments/webhook`,
};

/** POST pedido retirada (consumidor logado). */
export const PEDIDOS_API = '/api/parceiros/pedidos';
export const PEDIDOS_CHECKOUT_API = '/api/parceiros/pedidos/checkout';
export const pedidoTrackApi = (id) => `/api/parceiros/pedidos/${id}`;
