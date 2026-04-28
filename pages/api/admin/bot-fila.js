import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { canAccess } from '../../../lib/access-server';
import { canAccessAdminRoutes } from '../../../lib/adminAccess';
import { createClient } from '@supabase/supabase-js';
import {
  splitProdutosByPublishReadiness,
} from '../../../lib/promoQueueProcessing';
import { getCachedImageUrlFromDb } from '../../../lib/mapProductImageCache';
import { resolveOwnerUserId } from '../../../lib/botPromoOwner';
import { getLatestIngestRejections } from '../../../lib/ingest/rejectionLog';

const GRANDE_SP_CITIES = new Set([
  'sao paulo', 'guarulhos', 'osasco', 'santo andre', 'sao bernardo do campo', 'sao caetano do sul',
  'diadema', 'maua', 'barueri', 'carapicuiba', 'itapecerica da serra', 'embu das artes', 'taboao da serra',
  'cotia', 'itapevi', 'jandira', 'santana de parnaiba', 'franco da rocha', 'caieiras', 'francisco morato',
  'ribeirao pires', 'rio grande da serra', 'mogi das cruzes', 'suzano', 'poa', 'ferraz de vasconcelos'
]);
const LITORAL_SP_CITIES = new Set([
  'santos', 'sao vicente', 'praia grande', 'guaruja', 'cubatao', 'bertioga', 'itaniaem', 'peruibe', 'mongagua',
  'caraguatatuba', 'ubatuba', 'ilhabela', 'sao sebastiao',
]);

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function inferLocalityFromItem(item) {
  const city = String(item?.locality_city || item?.cidade || '').trim();
  const scope = String(item?.locality_scope || item?.escopo_localidade || '').trim();
  if (scope) return { locality_scope: scope, locality_city: city || null, locality_region: item?.locality_region || inferRegionByCity(city) };
  if (!city) return { locality_scope: 'Estadual', locality_city: null, locality_region: null };
  const scopeByCity = GRANDE_SP_CITIES.has(normalizeText(city)) ? 'Grande SP' : 'Cidade';
  return { locality_scope: scopeByCity, locality_city: city, locality_region: item?.locality_region || inferRegionByCity(city) };
}

function inferRegionByCity(city) {
  const n = normalizeText(city);
  if (!n) return null;
  if (n === 'sao paulo') return 'Capital';
  if (LITORAL_SP_CITIES.has(n)) return 'Litoral';
  return 'Interior';
}

function parseDateSafe(value) {
  if (!value) return null;
  const iso = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function computeProdutoDiscount(produto) {
  const promo = Number(produto?.current_price ?? produto?.preco ?? produto?.price ?? produto?.promo_price);
  const original = Number(produto?.preco_de ?? produto?.original_price ?? produto?.price_from);
  if (!Number.isFinite(promo) || !Number.isFinite(original) || original <= 0 || promo <= 0 || promo >= original) {
    return null;
  }
  return Number((((original - promo) / original) * 100).toFixed(2));
}

function summarizeQueueItem(item) {
  const produtos = Array.isArray(item?.produtos) ? item.produtos : [];
  const split = splitProdutosByPublishReadiness(produtos);
  let maxDiscount = null;
  let nearestExpiry = null;
  let inferredScope = null;
  let inferredCity = null;
  let inferredRegion = null;
  let inferredStatewide = item?.is_statewide === true;
  const strategyCount = {};
  for (const p of produtos) {
    const d = computeProdutoDiscount(p);
    if (d != null && (maxDiscount == null || d > maxDiscount)) maxDiscount = d;
    const exp = parseDateSafe(p?.expiry_date || p?.validade || p?.valid_until || p?.expires_at);
    if (exp && (!nearestExpiry || exp < nearestExpiry)) nearestExpiry = exp;
    if (p?.is_statewide === true) inferredStatewide = true;
    const strategy = String(p?.metadata?.extraction_strategy || p?.extraction_strategy || 'unknown');
    strategyCount[strategy] = (strategyCount[strategy] || 0) + 1;
    if (!inferredScope) {
      const loc = inferLocalityFromItem(p);
      inferredScope = loc.locality_scope;
      inferredCity = loc.locality_city;
      inferredRegion = loc.locality_region;
    }
  }
  const isStatewide = inferredStatewide || item?.locality_scope === 'Estadual';
  const dominantStrategy = Object.entries(strategyCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';
  return {
    ...item,
    locality_scope: isStatewide ? 'Estadual' : (item?.locality_scope || inferredScope || 'Estadual'),
    locality_city: isStatewide ? null : (item?.locality_city || inferredCity || null),
    locality_region: isStatewide ? null : (item?.locality_region || inferredRegion || inferRegionByCity(item?.locality_city)),
    is_statewide: Boolean(isStatewide),
    extraction_strategy: dominantStrategy,
    max_discount_percent: maxDiscount,
    nearest_expiry_at: nearestExpiry ? nearestExpiry.toISOString() : null,
    queue_meta: {
      total: produtos.length,
      ready: split.ready.length,
      invalid_price: split.invalid.length,
      pending_image: split.pendingImage.length,
      only_problem: split.ready.length === 0 && (split.invalid.length > 0 || split.pendingImage.length > 0),
    },
  };
}

function buildExtractionHealth(items, maxOffers = 100) {
  const strategyCount = {};
  let total = 0;
  for (const row of items || []) {
    const produtos = Array.isArray(row?.produtos) ? row.produtos : [];
    for (const p of produtos) {
      const strategy = String(p?.metadata?.extraction_strategy || p?.extraction_strategy || 'unknown');
      strategyCount[strategy] = (strategyCount[strategy] || 0) + 1;
      total += 1;
      if (total >= maxOffers) break;
    }
    if (total >= maxOffers) break;
  }
  const jsonCount = (strategyCount.next_data || 0) + (strategyCount.ld_json || 0) + (strategyCount.parsed_object || 0);
  const htmlCount = strategyCount.html_regex || 0;
  return {
    total,
    strategyCount,
    jsonPercent: total > 0 ? Math.round((jsonCount / total) * 100) : 0,
    htmlPercent: total > 0 ? Math.round((htmlCount / total) * 100) : 0,
  };
}

function buildPendingDiagnostics(items) {
  let entries = 0;
  let totalProducts = 0;
  let readyProducts = 0;
  let invalidPriceProducts = 0;
  let pendingImageProducts = 0;
  let entriesOnlyInvalid = 0;
  let entriesReadyToPublish = 0;

  for (const item of items || []) {
    const produtos = Array.isArray(item?.produtos) ? item.produtos : [];
    const split = splitProdutosByPublishReadiness(produtos);
    const hasReady = split.ready.length > 0;
    const hasInvalid = split.invalid.length > 0;
    const hasPendingImage = split.pendingImage.length > 0;

    entries += 1;
    totalProducts += produtos.length;
    readyProducts += split.ready.length;
    invalidPriceProducts += split.invalid.length;
    pendingImageProducts += split.pendingImage.length;
    if (hasReady) entriesReadyToPublish += 1;
    if (!hasReady && (hasInvalid || hasPendingImage)) entriesOnlyInvalid += 1;
  }

  return {
    entries,
    totalProducts,
    readyProducts,
    invalidPriceProducts,
    pendingImageProducts,
    entriesReadyToPublish,
    entriesOnlyInvalid,
  };
}

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '').trim()
  );
}

async function checkAdmin(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    res.status(401).json({ error: 'Não autenticado' });
    return null;
  }
  const allowed = await canAccessAdminRoutes(session.user.email, () =>
    canAccess(session.user.email)
  );
  if (!allowed) {
    res.status(403).json({ error: 'Acesso negado' });
    return null;
  }
  return session;
}

export default async function handler(req, res) {
  const session = await checkAdmin(req, res);
  if (!session) return;

  const supabase = getSupabaseAdmin();

  // GET — lista pendentes
  if (req.method === 'GET') {
    const sortBy = String(req.query?.sort || 'recentes');
    const scopeFilter = String(req.query?.scope || 'todos');
    const cityView = String(req.query?.cityView || 'all');
    const cityFilter = String(req.query?.city || '').trim();
    const limit = Math.max(50, Math.min(600, Number(req.query?.limit) || 250));
    const { data, error } = await supabase
      .from('bot_promocoes_fila')
      .select('*')
      .eq('status', 'pendente')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return res.status(500).json({ error: error.message });

    const { data: legacyRows, error: legacyErr } = await supabase
      .from('price_points')
      .select('store_name, created_at, image_url, price')
      .or('source.is.null,source.eq.legado')
      .order('created_at', { ascending: false })
      .limit(4000);
    if (legacyErr) return res.status(500).json({ error: legacyErr.message });
    const SUPERMARKET_DOMAINS_RE = /\.(dia|assai|carrefour|extra|paodeacucar|atacadao|bistek|condor)\.com/i;
    function isSupermarketUrl(url) {
      if (!url) return false;
      try { return SUPERMARKET_DOMAINS_RE.test(new URL(url).hostname); } catch { return false; }
    }
    const byStore = new Map();
    for (const row of legacyRows || []) {
      const key = String(row.store_name || '').trim() || 'Loja sem nome';
      if (!byStore.has(key)) {
        byStore.set(key, { store_name: key, count: 0, latest_created_at: row.created_at || null, sem_imagem: 0, preco_zero: 0, imagem_suja: 0 });
      }
      const it = byStore.get(key);
      it.count += 1;
      if ((row.created_at || '') > (it.latest_created_at || '')) it.latest_created_at = row.created_at || null;
      if (!row.image_url) it.sem_imagem++;
      if (row.price == null || Number(row.price) === 0) it.preco_zero++;
      if (isSupermarketUrl(row.image_url)) it.imagem_suja++;
    }
    const extractionHealth = buildExtractionHealth(data || [], 100);
    const enriched = (data || []).map(summarizeQueueItem).filter((item) => {
      if (scopeFilter === 'todos') return true;
      if (scopeFilter === 'cidade') return item.locality_scope === 'Cidade';
      return item.locality_scope === scopeFilter;
    }).filter((item) => {
      if (cityView === 'capital') return normalizeText(item.locality_city) === 'sao paulo';
      if (cityView === 'interior') return item.locality_region === 'Interior';
      return true;
    }).filter((item) => {
      if (!cityFilter || cityFilter === 'all') return true;
      return normalizeText(item.locality_city) === normalizeText(cityFilter);
    });
    enriched.sort((a, b) => {
      if (sortBy === 'desconto') {
        return (b.max_discount_percent || -1) - (a.max_discount_percent || -1);
      }
      if (sortBy === 'expiracao') {
        if (!a.nearest_expiry_at && !b.nearest_expiry_at) return 0;
        if (!a.nearest_expiry_at) return 1;
        if (!b.nearest_expiry_at) return -1;
        return new Date(a.nearest_expiry_at).getTime() - new Date(b.nearest_expiry_at).getTime();
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    const legacyGroups = Array.from(byStore.values()).sort((a, b) => b.count - a.count);
    const pendingDiagnostics = buildPendingDiagnostics(enriched);
    const { data: rejectedRows, error: rejectedErr } = await supabase
      .from('bot_promocoes_fila')
      .select('id, store_name, reviewed_at, reviewed_by, artifacts')
      .eq('status', 'rejeitado')
      .order('reviewed_at', { ascending: false })
      .limit(30);
    if (rejectedErr) return res.status(500).json({ error: rejectedErr.message });
    const rejectionHistory = (rejectedRows || []).map((row) => {
      const moderation =
        row?.artifacts?.moderation && typeof row.artifacts.moderation === 'object'
          ? row.artifacts.moderation
          : {};
      return {
        id: row.id,
        store_name: row.store_name,
        reviewed_at: row.reviewed_at || moderation.rejected_at || null,
        reviewed_by: row.reviewed_by || moderation.rejected_by || null,
        rejection_reason: moderation.rejection_reason || null,
      };
    });
    return res.status(200).json({
      items: enriched,
      legacyGroups,
      ingestRejections: getLatestIngestRejections(5),
      extractionHealth,
      pendingDiagnostics,
      rejectionHistory,
    });
  }

  // POST — aprovar ou rejeitar
  if (req.method === 'POST') {
    const { id, action, store_name: legacyStoreName, rejection_reason: rejectionReasonRaw } = req.body || {};
    if (!['aprovar', 'rejeitar', 'reprocessar_legado'].includes(action)) {
      return res.status(400).json({ error: 'action inválida. Use aprovar|rejeitar|reprocessar_legado' });
    }

    if (action === 'reprocessar_legado') {
      if (!legacyStoreName || typeof legacyStoreName !== 'string') {
        return res.status(400).json({ error: 'store_name é obrigatório para reprocessar legado' });
      }
      const { data: legacyRows, error: legacyErr } = await supabase
        .from('price_points')
        .select('id, store_name, lat, lng, product_name, price, image_url')
        .eq('store_name', legacyStoreName)
        .or('source.is.null,source.eq.legado')
        .order('created_at', { ascending: false })
        .limit(600);
      if (legacyErr) return res.status(500).json({ error: legacyErr.message });
      if (!legacyRows?.length) return res.status(200).json({ ok: true, enqueued: 0, note: 'Nenhum legado para esta loja' });

      const base = legacyRows[0];
      const produtos = legacyRows.map((r) => ({
        nome: r.product_name,
        preco: r.price != null ? Number(r.price) : null,
        imagem_url: r.image_url || null,
      }));
      const { error: qErr } = await supabase.from('bot_promocoes_fila').insert({
        store_name: base.store_name,
        store_address: null,
        store_lat: base.lat,
        store_lng: base.lng,
        produtos,
        origem: 'migration_legacy_reprocess',
        status: 'pendente',
      });
      if (qErr) return res.status(500).json({ error: qErr.message });

      const ids = legacyRows.map((r) => r.id).filter(Boolean);
      if (ids.length) {
        await supabase
          .from('price_points')
          .update({ source: 'legado_enfileirado' })
          .in('id', ids);
      }
      return res.status(200).json({ ok: true, enqueued: produtos.length });
    }

    if (!id || !['aprovar', 'rejeitar'].includes(action)) {
      return res.status(400).json({ error: 'id e action (aprovar|rejeitar) são obrigatórios' });
    }

    if (action === 'rejeitar') {
      const { data: currentRow, error: currentErr } = await supabase
        .from('bot_promocoes_fila')
        .select('artifacts')
        .eq('id', id)
        .single();
      if (currentErr) return res.status(500).json({ error: currentErr.message });
      const reason = String(rejectionReasonRaw || '').trim();
      const currentArtifacts =
        currentRow?.artifacts && typeof currentRow.artifacts === 'object' ? currentRow.artifacts : {};
      const artifacts = {
        ...currentArtifacts,
        moderation: {
          ...(currentArtifacts.moderation && typeof currentArtifacts.moderation === 'object'
            ? currentArtifacts.moderation
            : {}),
          rejection_reason: reason || null,
          rejected_at: new Date().toISOString(),
          rejected_by: session.user.email,
        },
      };
      const { error } = await supabase
        .from('bot_promocoes_fila')
        .update({
          status: 'rejeitado',
          reviewed_at: new Date().toISOString(),
          reviewed_by: session.user.email,
          artifacts,
        })
        .eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true, rejection_reason: reason || null });
    }

    // action === 'aprovar': busca o item e publica no mapa com guard-rails
    const { data: item, error: fetchErr } = await supabase
      .from('bot_promocoes_fila')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !item) return res.status(404).json({ error: 'Item não encontrado' });

    const produtos = Array.isArray(item.produtos) ? item.produtos : [];
    const now = new Date().toISOString();

    const resolvedOwnerUserId = await resolveOwnerUserId(supabase, session.user.email);
    const fallbackSessionUserId =
      isUuid(session?.user?.supabaseId) ? String(session.user.supabaseId).trim() : null;
    const ownerUserId = resolvedOwnerUserId || fallbackSessionUserId;
    if (!ownerUserId) {
      return res.status(500).json({
        error:
          'Não foi possível resolver owner user_id válido para publicar promoções. Configure BOT_PROMO_OWNER_USER_ID ou MAP_QUICK_ADD_BOT_USER_ID.',
      });
    }

    // Resolve ou cria a loja
    const { data: storeData, error: storeErr } = await supabase.rpc('find_or_create_store', {
      p_name: item.store_name,
      p_address: item.store_address || '',
      p_lat: item.store_lat,
      p_lng: item.store_lng,
    });

    if (storeErr) return res.status(500).json({ error: `Erro ao resolver loja: ${storeErr.message}` });

    const storeId = storeData;
    if (!storeId) {
      return res.status(500).json({ error: 'Não foi possível resolver store_id na RPC find_or_create_store.' });
    }

    const split = splitProdutosByPublishReadiness(produtos);
    const missingImageAfterCache = [];
    for (const p of split.pendingImage) {
      // Tenta resolver do cache interno antes de devolver para fila de imagem.
      // eslint-disable-next-line no-await-in-loop
      const cached = await getCachedImageUrlFromDb(supabase, p._normalized_name || p.nome || p.name || '');
      if (cached) {
        split.ready.push({
          name: p._normalized_name || p.nome || p.name || '',
          price: Number(p.current_price ?? p.preco),
          image_url: cached,
          raw: p,
        });
      } else {
        missingImageAfterCache.push(p);
      }
    }

    const rows = split.ready.map((p) => {
      const originalPrice = Number(p?.raw?.original_price ?? p?.raw?.preco_de ?? p?.raw?.price_from);
      const discountPercent =
        Number.isFinite(originalPrice) && originalPrice > 0 && Number(p.price) > 0 && Number(p.price) < originalPrice
          ? Number((((originalPrice - Number(p.price)) / originalPrice) * 100).toFixed(2))
          : null;
      const loc = inferLocalityFromItem(p?.raw || {});
      const isStatewide = Boolean(item.is_statewide || p?.raw?.is_statewide || item.locality_scope === 'Estadual');
      return {
        user_id: ownerUserId,
        store_name: item.store_name,
        lat: item.store_lat,
        lng: item.store_lng,
        product_name: p.name,
        price: Number(p.price),
        image_url: p.image_url || null,
        category: 'Supermercado - Promoção',
        // O mapa público só considera promoções aprovadas com source "bot_fila_aprovado".
        // Não usar metadata.source aqui para evitar "aprova no admin, mas some no mapa".
        source: 'bot_fila_aprovado',
        created_at: now,
        atualizado_em: now,
        locality_scope: isStatewide ? 'Estadual' : (item.locality_scope || loc.locality_scope || 'Estadual'),
        locality_city: isStatewide ? null : (item.locality_city || loc.locality_city || null),
        locality_region: isStatewide
          ? null
          : (item.locality_region || loc.locality_region || inferRegionByCity(item.locality_city || loc.locality_city)),
        locality_state: 'SP',
        ddd_code: item.ddd_code || p?.raw?.ddd_code || null,
        is_statewide: isStatewide,
        expires_at: p.valid_until || p?.raw?.expiry_date || p?.raw?.validade || p?.raw?.valid_until || null,
        discount_percent: discountPercent,
        unit_normalized: p.unit || null,
      };
    });

    if (rows.length > 0) {
      const { error: insertErr } = await supabase.from('price_points').insert(rows);
      if (insertErr) return res.status(500).json({ error: `Erro ao publicar no mapa: ${insertErr.message}` });
    }

    console.log('[bot-fila approve]', { inserted: rows.length, pending_image: missingImageAfterCache.length, invalid: split.invalid.length });

    const remaining = [...missingImageAfterCache, ...split.invalid];
    if (remaining.length > 0) {
      await supabase
        .from('bot_promocoes_fila')
        .update({
          produtos: remaining,
          reviewed_at: null,
          reviewed_by: null,
        })
        .eq('id', id);

      return res.status(200).json({
        ok: true,
        inserted: rows.length,
        pending_image: missingImageAfterCache.length,
        invalid_price: split.invalid.length,
        note:
          'Parte dos produtos ficou na fila para curadoria de imagem/preço. Aprovado parcial, sem publicar itens incompletos.',
      });
    }

    await supabase
      .from('bot_promocoes_fila')
      .update({ status: 'aprovado', reviewed_at: now, reviewed_by: session.user.email })
      .eq('id', id);

    return res.status(200).json({ ok: true, inserted: rows.length, owner_user_id: ownerUserId });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
