import { getSupabaseAdmin } from '../../supabaseAdmin';
import {
  EQUIPE_COOKIE,
  verifyEquipeToken,
} from './equipeAuth';

/**
 * Lê cookie da equipe (garçom/cozinha/caixa).
 * @param {import('next').NextApiRequest} req
 * @param {import('next').NextApiResponse} res
 */
export async function requireEquipeApi(req, res) {
  const token = req.cookies?.[EQUIPE_COOKIE];
  const payload = verifyEquipeToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Faça login da equipe (código da loja + PIN).' });
    return null;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    res.status(500).json({ error: 'Serviço indisponível' });
    return null;
  }

  const { data: membro, error } = await supabase
    .from('equipe_loja')
    .select('id, loja_id, nome, papel, ativo, telefone')
    .eq('id', payload.equipeId)
    .eq('loja_id', payload.lojaId)
    .maybeSingle();

  if (error || !membro || !membro.ativo) {
    res.status(401).json({ error: 'Sessão da equipe inválida ou desativada.' });
    return null;
  }

  const { data: store } = await supabase
    .from('stores')
    .select('id, name, lat, lng, codigo_equipe')
    .eq('id', membro.loja_id)
    .maybeSingle();

  if (!store) {
    res.status(403).json({ error: 'Loja não encontrada.' });
    return null;
  }

  return {
    supabase,
    membro: {
      id: membro.id,
      nome: membro.nome,
      papel: membro.papel,
      telefone: membro.telefone || null,
      loja_id: membro.loja_id,
    },
    store: {
      id: store.id,
      name: store.name,
      lat: store.lat,
      lng: store.lng,
      codigo_equipe: store.codigo_equipe,
    },
  };
}

/**
 * Dono da loja OU membro da equipe (para APIs de pedidos operacionais).
 */
export async function requireMerchantOrEquipeApi(req, res, { papéisAllowed } = {}) {
  const { requireMerchantApi } = await import('../requireMerchantApi');
  const merchant = await requireMerchantApi(req, res);
  if (merchant) {
    return { ...merchant, access: 'owner', equipe: null };
  }

  // requireMerchantApi já escreveu resposta — limpar só se 401 e tentar equipe
  // Na prática Next já enviou; precisamos de uma versão que não escreva.
  return null;
}
