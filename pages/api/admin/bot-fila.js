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

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
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
    const { data, error } = await supabase
      .from('bot_promocoes_fila')
      .select('*')
      .eq('status', 'pendente')
      .order('created_at', { ascending: false });

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
    const legacyGroups = Array.from(byStore.values()).sort((a, b) => b.count - a.count);
    return res.status(200).json({ items: data, legacyGroups });
  }

  // POST — aprovar ou rejeitar
  if (req.method === 'POST') {
    const { id, action, store_name: legacyStoreName } = req.body || {};
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
      const { error } = await supabase
        .from('bot_promocoes_fila')
        .update({ status: 'rejeitado', reviewed_at: new Date().toISOString(), reviewed_by: session.user.email })
        .eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
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

    const ownerUserId = await resolveOwnerUserId(supabase, session.user.email);
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
          price: Number(p.preco),
          image_url: cached,
          raw: p,
        });
      } else {
        missingImageAfterCache.push(p);
      }
    }

    const rows = split.ready.map((p) => ({
      user_id: ownerUserId,
      store_name: item.store_name,
      lat: item.store_lat,
      lng: item.store_lng,
      product_name: p.name,
      price: Number(p.price),
      image_url: p.image_url || null,
      category: 'Supermercado - Promoção',
      source: 'bot_fila_aprovado',
      created_at: now,
      atualizado_em: now,
    }));

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
