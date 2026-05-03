import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

let supabaseInstance = null;

function getSupabase() {
  if (!supabaseInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    supabaseInstance = createClient(url, key);
  }
  return supabaseInstance;
}

function fallbackExpiryDateForBotFila() {
  const promoTtlHours = Math.max(
    24,
    Number.parseInt(process.env.MAP_PROMO_TTL_HOURS || '168', 10) || 168
  );
  const dt = new Date(Date.now() + promoTtlHours * 60 * 60 * 1000);
  return dt.toISOString().slice(0, 10);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Gamificação via RPC `confirm_price_and_award_xp` (Supabase).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} appUserId
 * @param {string} establishmentId
 * @param {'price_points'|'agent_promotion'|'encarte'} source
 * @param {string} offerKey
 */
async function tryAwardGamification(supabase, appUserId, establishmentId, source, offerKey) {
  const { data, error } = await supabase.rpc('confirm_price_and_award_xp', {
    p_user_id: appUserId,
    p_establishment_id: establishmentId,
    p_source: source,
    p_offer_key: String(offerKey),
  });

  if (error) {
    if (
      /does not exist|confirm_price_and_award_xp|function|column|relation|42883/i.test(error.message || '')
    ) {
      return { awarded: false, reason: 'schema' };
    }
    console.warn('[confirm-offer-seen] confirm_price_and_award_xp:', error.message);
    return { awarded: false, reason: 'error' };
  }

  const row = data && typeof data === 'object' ? data : {};
  if (row.error === 'user_not_found' || row.error === 'missing_params' || row.error === 'invalid_source') {
    return { awarded: false, reason: 'schema' };
  }
  if (row.error === 'user_update_failed') {
    return { awarded: false, reason: 'error' };
  }

  const xpAwarded = Number(row.xp_awarded) || 0;
  const newXp = row.new_xp != null ? Number(row.new_xp) : undefined;
  const newLevel = row.new_level != null ? Number(row.new_level) : undefined;

  if (xpAwarded <= 0) {
    return {
      awarded: false,
      reason: 'already_today',
      xp_points: newXp,
      level: newLevel,
    };
  }

  return {
    awarded: true,
    xp_awarded: xpAwarded,
    xp_points: newXp,
    level: newLevel,
  };
}

/**
 * POST /api/map/confirm-offer-seen
 * Corpo: { offerId: string, storeId: string } — gamificação (XP) no máx. 1x/dia por oferta.
 *
 * Encartes (`public.promotions`) e ofertas do agente (`promocoes_supermercados`, id `promo-…`)
 * passam a não aparecer no painel da loja após confirmação: `active` / `ativo` = false.
 * `price_points` só atualiza recência (`atualizado_em` / `expires_at` quando aplicável).
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ error: 'Faça login para confirmar o preço na loja.' });
  }

  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error: 'Serviço indisponível' });

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'JSON inválido' });
    }
  }

  const { offerId, storeId } = body || {};
  if (!offerId || !storeId) {
    return res.status(400).json({ error: 'offerId e storeId são obrigatórios' });
  }
  if (!UUID_RE.test(String(storeId))) {
    return res.status(400).json({ error: 'storeId inválido' });
  }

  const nowIso = new Date().toISOString();
  const idStr = String(offerId);
  const appUserId = session.user.supabaseId;
  let gamification = { awarded: false, reason: 'no_user' };

  try {
    if (idStr.startsWith('promo-')) {
      const raw = idStr.slice(6);
      if (!UUID_RE.test(raw)) {
        return res.status(400).json({ error: 'Esta oferta não suporta confirmação automática' });
      }
      const { error } = await supabase
        .from('promocoes_supermercados')
        .update({ atualizado_em: nowIso, ativo: false })
        .eq('id', raw);
      if (error) return res.status(400).json({ error: error.message });
      if (appUserId) {
        gamification = await tryAwardGamification(supabase, appUserId, storeId, 'agent_promotion', raw);
      }
      return res.status(200).json({ ok: true, observed_at: nowIso, retired_from_list: true, ...gamification });
    }

    if (UUID_RE.test(idStr)) {
      const { data: pr, error: prErr } = await supabase
        .from('promotions')
        .select('id')
        .eq('id', idStr)
        .eq('store_id', storeId)
        .maybeSingle();
      if (!prErr && pr?.id) {
        const { error: retireErr } = await supabase
          .from('promotions')
          .update({ active: false })
          .eq('id', idStr)
          .eq('store_id', storeId);
        if (retireErr) return res.status(400).json({ error: retireErr.message });
        if (appUserId) {
          gamification = await tryAwardGamification(supabase, appUserId, storeId, 'encarte', idStr);
        }
        return res.status(200).json({ ok: true, observed_at: nowIso, retired_from_list: true, ...gamification });
      }

      // Algumas linhas antigas (source=bot_fila_aprovado) podem ter expires_at nulo
      // e quebram no UPDATE por causa da constraint de validade obrigatória.
      const { data: pointRow, error: pointErr } = await supabase
        .from('price_points')
        .select('id, source, expires_at')
        .eq('id', idStr)
        .maybeSingle();
      if (pointErr) return res.status(400).json({ error: pointErr.message });
      if (!pointRow?.id) return res.status(404).json({ error: 'Oferta não encontrada' });

      const updatePayload = { atualizado_em: nowIso };
      if (pointRow.source === 'bot_fila_aprovado' && !pointRow.expires_at) {
        updatePayload.expires_at = fallbackExpiryDateForBotFila();
      }

      const { error } = await supabase.from('price_points').update(updatePayload).eq('id', idStr);
      if (error) return res.status(400).json({ error: error.message });
      if (appUserId) {
        gamification = await tryAwardGamification(supabase, appUserId, storeId, 'price_points', idStr);
      }
      return res.status(200).json({ ok: true, observed_at: nowIso, ...gamification });
    }

    return res.status(400).json({ error: 'Tipo de oferta inválido' });
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Erro ao confirmar' });
  }
}
