import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { canAccess } from '../../../lib/access-server';
import {
  hasFinmemoryAdminAllowlist,
  isFinmemoryAdminEmail,
} from '../../../lib/adminAccess';
import { getMapQuickAddSupabase, resolveQuickAddAuth } from '../../../lib/mapQuickAddCore';
import { normalizeStoreNameMatchKey } from '../../../lib/mapStoreNameNormalize';
import { addressMatchesForStoreRemoval } from '../../../lib/mapStoreAddressNormalize';
import { resolveStoreNormSql } from '../../../lib/mapPinLocationSuppressions';

/**
 * POST /api/admin/remove-store-from-map
 * Desativa loja(s) em public.stores (active = false) — somem do mapa; não apaga linha (reversível no SQL).
 *
 * Body:
 * - store_name (obrigatório)
 * - scope: "address" | "all_names"
 * - address: obrigatório se scope === "address" (cole o endereço errado da duplicata)
 * - confirm: true
 * - confirm_remove_all_stores_with_name: true obrigatório se scope === "all_names"
 * - clear_promotional_points: opcional true — apaga price_points promocionais (categoria %promo%) com store_name exato
 * - blacklist_coordinates: opcional true — grava map_pin_location_suppressions (anti pin no mesmo sítio + bloqueio find_or_create)
 * - confirm_blacklist_coordinates: true se blacklist_coordinates
 * - blacklist_radius_m: opcional (50–5000, default 280)
 * - blacklist_note: opcional
 * - curated_pin_opt_out: opcional true — grava map_curated_pin_opt_out (Pomar/Sacolão tratados como super sem bypass se reativados)
 * - confirm_curated_pin_opt_out: true se curated_pin_opt_out
 * - curated_pin_opt_out_note: opcional
 *
 * Auth: igual ao Quick Add.
 */

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
  const scope = body.scope === 'all_names' ? 'all_names' : 'address';
  const rawAddress = typeof body.address === 'string' ? body.address.trim() : '';
  const confirm = body.confirm === true;
  const confirmAll = body.confirm_remove_all_stores_with_name === true;
  const clearPromotionalPoints = body.clear_promotional_points === true;
  const blacklistCoordinates = body.blacklist_coordinates === true;
  const confirmBlacklist = body.confirm_blacklist_coordinates === true;
  const curatedPinOptOut = body.curated_pin_opt_out === true;
  const confirmCuratedOptOut = body.confirm_curated_pin_opt_out === true;

  if (!rawName || rawName.length < 2) {
    return res.status(400).json({ error: 'store_name é obrigatório.' });
  }
  if (!confirm) {
    return res.status(400).json({ error: 'Envie confirm: true para desativar a(s) loja(s).' });
  }
  if (scope === 'address' && (!rawAddress || rawAddress.length < 5)) {
    return res.status(400).json({
      error: 'Com “só este endereço”, cole o endereço completo (mín. 5 caracteres) da loja a remover.',
    });
  }
  if (scope === 'all_names' && !confirmAll) {
    return res.status(400).json({
      error:
        'Para desativar todas as lojas com este nome, envie confirm_remove_all_stores_with_name: true.',
    });
  }
  if (blacklistCoordinates && !confirmBlacklist) {
    return res.status(400).json({
      error:
        'Para bloquear esta coordenada no mapa (anti “pin fantasma”), envie confirm_blacklist_coordinates: true.',
    });
  }
  if (curatedPinOptOut && !confirmCuratedOptOut) {
    return res.status(400).json({
      error:
        'Para gravar opt-out da curadoria Pomar/Sacolão nesta(s) loja(s), envie confirm_curated_pin_opt_out: true.',
    });
  }

  const norm = normalizeStoreNameMatchKey(rawName);
  if (!norm) {
    return res.status(400).json({ error: 'Nome da loja inválido.' });
  }

  const ilikeNeedle = safeIlikeContains(rawName);
  if (!ilikeNeedle) {
    return res.status(400).json({ error: 'Nome inválido após sanitização.' });
  }

  const { data: storeRows, error: storeErr } = await supabase
    .from('stores')
    .select('id, name, address, lat, lng')
    .eq('active', true)
    .ilike('name', `%${ilikeNeedle}%`)
    .limit(250);

  if (storeErr) {
    console.warn('remove-store-from-map stores:', storeErr.message);
    return res.status(500).json({ error: storeErr.message });
  }

  const nameMatched = (storeRows || []).filter((s) => normalizeStoreNameMatchKey(s.name) === norm);

  if (nameMatched.length === 0) {
    return res.status(404).json({
      error: 'Nenhuma loja ativa encontrada com esse nome (normalizado).',
      norm_key: norm,
    });
  }

  let toDeactivate = [];

  if (scope === 'all_names') {
    toDeactivate = nameMatched;
  } else {
    toDeactivate = nameMatched.filter((s) => addressMatchesForStoreRemoval(s.address, rawAddress));
    if (toDeactivate.length === 0) {
      return res.status(404).json({
        error:
          'Nenhuma loja ativa com esse nome casa com o endereço colado. Confira o texto (rua, número, bairro) ou use “todas com este nome”.',
        candidates: nameMatched.map((s) => ({
          id: s.id,
          name: s.name,
          address: s.address || '',
        })),
      });
    }
    if (toDeactivate.length > 1) {
      return res.status(409).json({
        error:
          'Várias lojas com o mesmo nome e endereço semelhante. Refine o endereço (mais caracteres únicos) ou use o SQL / suporte.',
        matches: toDeactivate.map((s) => ({
          id: s.id,
          name: s.name,
          address: s.address || '',
        })),
      });
    }
  }

  const ids = toDeactivate.map((s) => s.id).filter(Boolean);
  const { data: updated, error: updErr } = await supabase
    .from('stores')
    .update({ active: false })
    .in('id', ids)
    .eq('active', true)
    .select('id, name, address, lat, lng');

  if (updErr) {
    console.warn('remove-store-from-map update:', updErr.message);
    return res.status(500).json({ error: updErr.message || 'Falha ao desativar loja(s).' });
  }

  const deactivatedRows = updated || [];
  const toClearNames = [
    ...new Set(
      toDeactivate.map((s) => String(s.name || '').trim()).filter(Boolean)
    ),
  ];

  let promoPointsDeleted = 0;
  if (clearPromotionalPoints && toClearNames.length > 0) {
    for (const storeNameExact of toClearNames) {
      const { error: delErr, count } = await supabase
        .from('price_points')
        .delete({ count: 'exact' })
        .eq('store_name', storeNameExact)
        .ilike('category', '%promo%');
      if (delErr) {
        console.warn('remove-store-from-map price_points:', delErr.message);
      } else {
        promoPointsDeleted += count ?? 0;
      }
    }
  }

  let curatedOptOutUpserts = 0;
  if (curatedPinOptOut && ids.length > 0) {
    const coNote =
      typeof body.curated_pin_opt_out_note === 'string'
        ? body.curated_pin_opt_out_note.trim().slice(0, 500)
        : null;
    const rows = ids.map((id) => ({
      store_id: id,
      note: coNote || null,
    }));
    const { error: coErr } = await supabase.from('map_curated_pin_opt_out').upsert(rows, {
      onConflict: 'store_id',
    });
    if (coErr) {
      console.warn('remove-store-from-map map_curated_pin_opt_out:', coErr.message);
    } else {
      curatedOptOutUpserts = rows.length;
    }
  }

  let blacklistRowsInserted = 0;
  if (blacklistCoordinates && deactivatedRows.length > 0) {
    let radius = Number(body.blacklist_radius_m);
    if (!Number.isFinite(radius) || radius <= 0) radius = 280;
    radius = Math.min(5000, Math.max(50, radius));
    const note =
      typeof body.blacklist_note === 'string' ? body.blacklist_note.trim().slice(0, 500) : null;

    for (const s of toDeactivate) {
      const lat = Number(s.lat);
      const lng = Number(s.lng);
      const normJs = normalizeStoreNameMatchKey(s.name);
      if (!normJs || Number.isNaN(lat) || Number.isNaN(lng)) continue;
      let normSql = await resolveStoreNormSql(supabase, s.name);
      if (!normSql) normSql = normJs;

      const { error: insErr } = await supabase.from('map_pin_location_suppressions').insert({
        store_norm_key_js: normJs,
        store_norm_name_sql: normSql,
        center_lat: lat,
        center_lng: lng,
        radius_m: radius,
        note,
      });
      if (insErr) {
        console.warn('remove-store-from-map suppression:', insErr.message);
      } else {
        blacklistRowsInserted += 1;
      }
    }
  }

  return res.status(200).json({
    ok: true,
    deactivated_count: deactivatedRows.length,
    scope,
    stores: deactivatedRows.map((s) => ({
      id: s.id,
      name: s.name,
      address: s.address || '',
    })),
    promo_points_deleted: clearPromotionalPoints ? promoPointsDeleted : undefined,
    map_pin_suppressions_inserted: blacklistCoordinates ? blacklistRowsInserted : undefined,
    curated_pin_opt_out_upserted: curatedPinOptOut ? curatedOptOutUpserts : undefined,
    note:
      'Lojas ficam com active = false (reversível no Supabase). Use clear_promotional_points + blacklist_coordinates para limpar ofertas e impedir o pin no mesmo sítio; curated_pin_opt_out evita bypass Pomar/Sacolão se a loja for reativada.',
  });
}
