import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { canAccess } from '../../../lib/access-server';
import {
  hasFinmemoryAdminAllowlist,
  isFinmemoryAdminEmail,
} from '../../../lib/adminAccess';
import { getMapQuickAddSupabase, resolveQuickAddAuth } from '../../../lib/mapQuickAddCore';
import { inferChainSlugFromPromoStoreName } from '../../../lib/mapStoreChainMatch';
import { normalizeStoreNameMatchKey } from '../../../lib/mapStoreNameNormalize';

/**
 * POST /api/admin/clear-store-map-promos
 * Remove ofertas divulgadas no mapa para uma loja (nome como no cadastro / Quick Add).
 *
 * - price_points: apaga linhas com categoria promocional (ilike %promo%) e store_name que casa (normalizado).
 * - promotions: active = false para a loja em `stores` (encarte / Vision).
 * - promocoes_supermercados: ativo = false por loja (bbox ~400 m + slug da rede quando aplicável).
 *
 * Body: { store_name: string, confirm: true }
 *
 * Auth: igual ao Quick Add (sessão admin ou x-map-quick-add-secret).
 */

function isMapPromoCategory(cat) {
  const s = cat == null ? '' : String(cat).toLowerCase();
  return s.includes('promo');
}

/** Remove caracteres que quebram o padrão ILIKE (% _ \). */
function safeIlikeContains(s) {
  return String(s || '')
    .replace(/[%_\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getMapQuickAddSupabase();
  if (!supabase) {
    return res.status(500).json({ error: 'Configuração do servidor incompleta' });
  }

  const session = await getServerSession(req, res, authOptions);
  const auth = resolveQuickAddAuth(req, session);
  if (auth?.error === 'invalid_secret') {
    return res.status(403).json({ error: 'x-map-quick-add-secret inválido.' });
  }
  if (auth?.error === 'secret_not_configured') {
    return res.status(503).json({ error: 'MAP_QUICK_ADD_SECRET não configurado no servidor.' });
  }
  if (auth?.error === 'bot_user_missing') {
    return res.status(503).json({ error: 'Configure MAP_QUICK_ADD_BOT_USER_ID para uso com segredo.' });
  }
  if (!auth?.userId) {
    return res.status(401).json({ error: 'Faça login ou envie x-map-quick-add-secret válido.' });
  }

  if (auth.via === 'session' && session?.user?.email) {
    if (hasFinmemoryAdminAllowlist()) {
      if (!isFinmemoryAdminEmail(session.user.email)) {
        return res.status(403).json({ error: 'Acesso restrito ao painel operacional.' });
      }
    } else {
      const allowed = await canAccess(session.user.email);
      if (!allowed) {
        return res.status(403).json({ error: 'Sem permissão.' });
      }
    }
  }

  const body = req.body || {};
  const rawName = typeof body.store_name === 'string' ? body.store_name.trim() : '';
  const confirm = body.confirm === true;

  if (!rawName || rawName.length < 2) {
    return res.status(400).json({ error: 'store_name é obrigatório (mín. 2 caracteres).' });
  }
  if (!confirm) {
    return res.status(400).json({
      error: 'Envie confirm: true para confirmar a remoção das ofertas desta loja no mapa.',
    });
  }

  const norm = normalizeStoreNameMatchKey(rawName);
  if (!norm) {
    return res.status(400).json({ error: 'Nome da loja inválido.' });
  }

  const ilikeNeedle = safeIlikeContains(rawName);
  if (!ilikeNeedle) {
    return res.status(400).json({ error: 'Nome da loja inválido após sanitização.' });
  }

  const { data: storeRows, error: storeErr } = await supabase
    .from('stores')
    .select('id, name, lat, lng')
    .eq('active', true)
    .ilike('name', `%${ilikeNeedle}%`)
    .limit(200);

  if (storeErr) {
    console.warn('clear-store-map-promos stores:', storeErr.message);
    return res.status(500).json({ error: storeErr.message });
  }

  const storesMatch = (storeRows || []).filter((s) => normalizeStoreNameMatchKey(s.name) === norm);

  if (storesMatch.length > 1) {
    return res.status(409).json({
      error:
        'Várias lojas ativas com o mesmo nome normalizado. Use o nome exato como no cadastro (inclua filial/bairro) ou corrija duplicados em `stores`.',
      matches: storesMatch.map((s) => ({ id: s.id, name: s.name })),
    });
  }

  const { data: ppSample, error: ppErr } = await supabase
    .from('price_points')
    .select('store_name, category')
    .ilike('store_name', `%${ilikeNeedle}%`)
    .limit(2500);

  if (ppErr) {
    console.warn('clear-store-map-promos price_points sample:', ppErr.message);
    return res.status(500).json({ error: ppErr.message });
  }

  const ppNames = [
    ...new Set(
      (ppSample || [])
        .filter((r) => normalizeStoreNameMatchKey(r.store_name) === norm && isMapPromoCategory(r.category))
        .map((r) => String(r.store_name || '').trim())
        .filter(Boolean)
    ),
  ];

  const canonicalNames = [
    ...new Set([
      ...storesMatch.map((s) => String(s.name || '').trim()).filter(Boolean),
      ...ppNames,
    ]),
  ];

  if (canonicalNames.length === 0) {
    return res.status(404).json({
      error: 'Nenhuma loja cadastrada nem ponto promocional em price_points encontrado para esse nome.',
      norm_key: norm,
    });
  }

  let pricePointsDeleted = 0;
  for (const storeNameExact of canonicalNames) {
    const { error: delErr, count } = await supabase
      .from('price_points')
      .delete({ count: 'exact' })
      .eq('store_name', storeNameExact)
      .ilike('category', '%promo%');
    if (delErr) {
      console.warn('clear-store-map-promos delete pp:', delErr.message);
      return res.status(500).json({ error: delErr.message || 'Falha ao apagar price_points.' });
    }
    pricePointsDeleted += count ?? 0;
  }

  let promotionsDeactivated = 0;
  const storeIds = storesMatch.map((s) => s.id).filter(Boolean);
  if (storeIds.length) {
    const { data: prBefore, error: prErr } = await supabase
      .from('promotions')
      .update({ active: false })
      .in('store_id', storeIds)
      .eq('active', true)
      .select('id');
    if (prErr) {
      console.warn('clear-store-map-promos promotions:', prErr.message);
    } else {
      promotionsDeactivated = prBefore?.length ?? 0;
    }
  }

  let agentPromosDeactivated = 0;
  /** Schema atual: sem `store_name` em promocoes_supermercados — cruzar rede (slug) + bbox da loja. */
  if (storesMatch.length === 1) {
    const st = storesMatch[0];
    const lat = Number(st.lat);
    const lng = Number(st.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const pad = 0.004;
      const slug = inferChainSlugFromPromoStoreName(st.name);
      let psQ = supabase
        .from('promocoes_supermercados')
        .select('id')
        .eq('ativo', true)
        .gte('lat', lat - pad)
        .lte('lat', lat + pad)
        .gte('lng', lng - pad)
        .lte('lng', lng + pad)
        .limit(3000);
      if (slug) {
        psQ = psQ.eq('supermercado', slug);
      }
      const { data: psRows, error: psErr } = await psQ;

      if (psErr) {
        console.warn('clear-store-map-promos promocoes_supermercados:', psErr.message);
      } else if (psRows?.length) {
        const psIds = psRows.map((r) => r.id).filter(Boolean);
        const chunk = 400;
        for (let i = 0; i < psIds.length; i += chunk) {
          const slice = psIds.slice(i, i + chunk);
          const { data: upd, error: uErr } = await supabase
            .from('promocoes_supermercados')
            .update({ ativo: false })
            .in('id', slice)
            .eq('ativo', true)
            .select('id');
          if (uErr) {
            console.warn('clear-store-map-promos promocoes_supermercados:', uErr.message);
            break;
          }
          agentPromosDeactivated += upd?.length ?? 0;
        }
      }
    }
  }

  return res.status(200).json({
    ok: true,
    store_name_input: rawName,
    norm_key: norm,
    matched_store_names: canonicalNames,
    price_points_deleted: pricePointsDeleted,
    promotions_deactivated: promotionsDeactivated,
    promocoes_supermercados_deactivated: agentPromosDeactivated,
  });
}
