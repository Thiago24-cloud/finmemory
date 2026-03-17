import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { geocodeAddress } from '../../../../lib/geocode';

/**
 * POST /api/transactions/[id]/publish-to-map
 *
 * Publica os preços de uma compra no mapa (price_points).
 * Só permite compras das últimas 24 horas (a partir da data da compra).
 *
 * Body: { lat?: number, lng?: number } — opcional; se não enviar, usa geocoding do estabelecimento.
 */
let supabaseInstance = null;

function getSupabase() {
  if (!supabaseInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    supabaseInstance = createClient(url, key);
  }
  return supabaseInstance;
}

/** Permite divulgar no mapa se a compra foi feita nos últimos 7 dias (evita problema de fuso com data só YYYY-MM-DD). */
function canPublishToMapByDate(transactionDateStr) {
  if (!transactionDateStr) return false;
  const txDateStr = String(transactionDateStr).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(txDateStr)) return false;
  const txDate = new Date(txDateStr + 'T12:00:00Z');
  const now = new Date();
  const diffDays = Math.floor((now - txDate) / (24 * 60 * 60 * 1000));
  return diffDays >= 0 && diffDays <= 7;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.supabaseId;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Faça login para divulgar no mapa.' });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Configuração indisponível' });
  }

  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ success: false, error: 'ID da transação é obrigatório' });
  }

  const { lat: userLat, lng: userLng } = req.body || {};

  const { data: transaction, error: txError } = await supabase
    .from('transacoes')
    .select('id, user_id, estabelecimento, total, data, items, categoria')
    .eq('id', id)
    .single();

  if (txError || !transaction) {
    return res.status(404).json({ success: false, error: 'Transação não encontrada' });
  }

  if (String(transaction.user_id) !== String(userId)) {
    return res.status(403).json({ success: false, error: 'Esta compra não é sua' });
  }

  if (!canPublishToMapByDate(transaction.data)) {
    return res.status(400).json({
      success: false,
      error: 'Só é possível divulgar no mapa compras dos últimos 7 dias.'
    });
  }

  // Priorizar o endereço do estabelecimento (onde a compra foi feita), depois a localização de quem divulgou
  const storeName = (transaction.estabelecimento && String(transaction.estabelecimento).trim()) || '';
  let coords = null;
  if (storeName.length >= 2) {
    const queries = [
      `${storeName}, São Paulo, Brasil`,
      `${storeName}, SP, Brasil`,
      `${storeName}, Brasil`
    ].filter((q) => q.length >= 3);
    for (const geoQuery of queries) {
      coords = await geocodeAddress(geoQuery);
      if (coords && coords.lat != null && coords.lng != null) break;
    }
  }
  if (!coords) {
    const latNum = userLat != null ? parseFloat(userLat) : NaN;
    const lngNum = userLng != null ? parseFloat(userLng) : NaN;
    if (!Number.isNaN(latNum) && !Number.isNaN(lngNum) && latNum >= -90 && latNum <= 90 && lngNum >= -180 && lngNum <= 180) {
      coords = { lat: latNum, lng: lngNum };
    }
  }

  if (!coords || coords.lat == null || coords.lng == null) {
    const needLocation = !storeName || storeName.length < 2;
    return res.status(400).json({
      success: false,
      error: needLocation
        ? 'Ative a localização do navegador (ícone de localização na barra do site) e toque de novo em "Mapa".'
        : 'Não foi possível localizar o estabelecimento no mapa. Ative a localização do navegador e tente de novo para usar sua posição.'
    });
  }

  const pointsToInsert = [];
  let items = [];
  if (Array.isArray(transaction.items)) {
    items = transaction.items;
  } else if (transaction.items && typeof transaction.items === 'string') {
    try {
      const parsed = JSON.parse(transaction.items);
      items = Array.isArray(parsed) ? parsed : [];
    } catch (_) {}
  }
  // Se não tiver itens na transação, tentar buscar da tabela produtos (join do dashboard)
  if (items.length === 0) {
    const { data: produtos } = await supabase
      .from('produtos')
      .select('descricao, valor_total, valor_unitario')
      .eq('transacao_id', id);
    if (Array.isArray(produtos) && produtos.length > 0) {
      items = produtos.map((p) => ({
        name: p.descricao || '',
        nome: p.descricao || '',
        price: p.valor_total ?? p.valor_unitario ?? 0
      }));
    }
  }
  const category = transaction.categoria || null;
  const displayStoreName = storeName || 'Estabelecimento';

  if (items.length > 0) {
    items.forEach((item, idx) => {
      const name = (item && (item.name ?? item.nome ?? item.descricao) && String(item.name ?? item.nome ?? item.descricao).trim())
        ? String(item.name ?? item.nome ?? item.descricao).trim()
        : `Produto ${idx + 1}`;
      const price = parseFloat(item.price ?? item.valor ?? item.valor_total ?? 0) || 0;
      pointsToInsert.push({
        user_id: userId,
        product_name: name,
        price,
        store_name: displayStoreName,
        lat: coords.lat,
        lng: coords.lng,
        category
      });
    });
  } else {
    pointsToInsert.push({
      user_id: userId,
      product_name: 'Compra',
      price: parseFloat(transaction.total) || 0,
      store_name: displayStoreName,
      lat: coords.lat,
      lng: coords.lng,
      category
    });
  }

  const { error: insertErr } = await supabase.from('price_points').insert(pointsToInsert);
  if (insertErr) {
    console.warn('Erro ao inserir price_points (publish-to-map):', insertErr.message);
    return res.status(500).json({
      success: false,
      error: insertErr.message || 'Erro ao divulgar no mapa.'
    });
  }

  return res.status(200).json({
    success: true,
    mapPointsAdded: pointsToInsert.length
  });
}
