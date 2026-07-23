import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../pages/api/auth/[...nextauth]';
import { getSupabaseAdmin } from '../supabaseAdmin';
import { ensureMerchantStoreLink } from './ensureMerchantStoreLink';
import { resolveMerchantPanelAccess } from './resolveMerchantPanelAccess';
import { EQUIPE_COOKIE, verifyEquipeToken } from './equipe/equipeAuth';

/**
 * Sessão varejista sem exigir loja vinculada (ex.: repair-link).
 * @param {import('next').NextApiRequest} req
 * @param {import('next').NextApiResponse} res
 */
export async function requireMerchantSession(req, res) {
  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.supabaseId;
  const email = session?.user?.email;

  if (!email || !userId) {
    res.status(401).json({ error: 'Faça login para acessar o painel da loja.' });
    return null;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    res.status(500).json({ error: 'Serviço indisponível' });
    return null;
  }

  const access = await resolveMerchantPanelAccess(supabase, session);
  if (access === 'unavailable') {
    res.status(500).json({ error: 'Serviço indisponível' });
    return null;
  }
  if (access === 'need_profile') {
    res.status(403).json({
      code: 'MERCHANT_PROFILE_REQUIRED',
      error: 'Escolha o perfil Lojista em /escolher-perfil ou cadastre-se em /parceiros.',
    });
    return null;
  }
  if (access === 'no_store') {
    res.status(403).json({
      code: 'MERCHANT_STORE_NOT_LINKED',
      error: 'Nenhuma loja vinculada. Conclua o cadastro em /parceiros.',
    });
    return null;
  }

  return { supabase, session, userId, email };
}

async function tryEquipeContext(req) {
  const token = req.cookies?.[EQUIPE_COOKIE];
  const payload = verifyEquipeToken(token);
  if (!payload) return null;

  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data: membro } = await supabase
    .from('equipe_loja')
    .select('id, loja_id, nome, papel, ativo')
    .eq('id', payload.equipeId)
    .eq('loja_id', payload.lojaId)
    .eq('ativo', true)
    .maybeSingle();

  if (!membro) return null;

  const { data: storeRow } = await supabase
    .from('stores')
    .select('id, name, lat, lng, address, codigo_equipe, tempo_preparo_medio, active, needs_review')
    .eq('id', membro.loja_id)
    .maybeSingle();

  if (!storeRow) return null;

  return {
    supabase,
    session: null,
    userId: `equipe:${membro.id}`,
    email: null,
    store: {
      id: storeRow.id,
      name: storeRow.name,
      lat: storeRow.lat,
      lng: storeRow.lng,
      address: storeRow.address,
      codigo_equipe: storeRow.codigo_equipe,
      tempo_preparo_medio: storeRow.tempo_preparo_medio,
      active: storeRow.active,
      needs_review: storeRow.needs_review,
    },
    profile: null,
    usuarioLoja: { loja_id: membro.loja_id, cargo: membro.papel },
    equipe: {
      id: membro.id,
      nome: membro.nome,
      papel: membro.papel,
      loja_id: membro.loja_id,
    },
    isEquipe: true,
  };
}

/**
 * Dono (NextAuth) ou membro da equipe (cookie PIN).
 * @param {import('next').NextApiRequest} req
 * @param {import('next').NextApiResponse} res
 */
export async function requireMerchantApi(req, res) {
  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.supabaseId;
  const email = session?.user?.email;

  if (email && userId) {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      res.status(500).json({ error: 'Serviço indisponível' });
      return null;
    }

    const access = await resolveMerchantPanelAccess(supabase, session);
    if (access === 'unavailable') {
      res.status(500).json({ error: 'Serviço indisponível' });
      return null;
    }
    if (access === 'need_profile') {
      res.status(403).json({
        code: 'MERCHANT_PROFILE_REQUIRED',
        error: 'Escolha o perfil Lojista em /escolher-perfil ou cadastre-se em /parceiros.',
      });
      return null;
    }
    if (access === 'no_store') {
      res.status(403).json({
        code: 'MERCHANT_STORE_NOT_LINKED',
        error: 'Nenhuma loja vinculada. Conclua o cadastro em /parceiros.',
      });
      return null;
    }

    const ctx = await ensureMerchantStoreLink(supabase, userId);
    if (!ctx?.store?.id) {
      res.status(403).json({
        code: 'MERCHANT_STORE_NOT_LINKED',
        error: 'Nenhuma loja vinculada a esta conta. Conclua o cadastro em /parceiros.',
      });
      return null;
    }

    return {
      supabase,
      session,
      userId,
      email,
      store: ctx.store,
      profile: ctx.profile,
      usuarioLoja: ctx.usuarioLoja,
      equipe: null,
      isEquipe: false,
    };
  }

  const equipeCtx = await tryEquipeContext(req);
  if (equipeCtx) return equipeCtx;

  res.status(401).json({ error: 'Faça login para acessar o painel da loja.' });
  return null;
}
