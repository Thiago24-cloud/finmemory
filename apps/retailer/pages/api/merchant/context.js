import { requireMerchantApi } from '../../../lib/merchant/requireMerchantApi';

/**
 * GET /api/merchant/context — loja do tenant logado (store_id na sessão de negócio).
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await requireMerchantApi(req, res);
  if (!auth) return;

  const { store, profile } = auth;
  return res.status(200).json({
    store: {
      id: store.id,
      loja_id: store.id,
      name: store.name,
      nome_comercial: store.name,
      address: store.address,
      endereco: store.address,
      lat: store.lat,
      lng: store.lng,
      latitude: store.lat,
      longitude: store.lng,
      tempo_preparo_medio: store.tempo_preparo_medio ?? 15,
      active: store.active,
      status_ativa: store.active,
      needs_review: store.needs_review,
      cnpj: store.cnpj,
    },
    usuario_loja: auth.usuarioLoja
      ? { cargo: auth.usuarioLoja.cargo, loja_id: auth.usuarioLoja.loja_id }
      : null,
    profile: profile
      ? {
          business_name: profile.business_name,
          onboarding_status: profile.onboarding_status,
          responsible_name: profile.responsible_name,
        }
      : null,
  });
}
