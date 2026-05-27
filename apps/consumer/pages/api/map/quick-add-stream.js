import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { geocodeAddress } from '../../../lib/geocode';
import {
  digitsOnlyCnpj,
  getMapQuickAddSupabase,
  parseProductsFromBody,
  resolveQuickAddAuth,
} from '../../../lib/mapQuickAddCore';
import {
  buildPricePointInsertRows,
  getQuickAddInsertChunkSize,
  getQuickAddThumbConcurrency,
  insertPricePointsInChunks,
  resolveQuickAddThumbnailsParallel,
} from '../../../lib/quickAddPricePointsBulk';
import { sseTryFlushRes } from '../../../lib/sseTryFlushRes';

/**
 * POST /api/map/quick-add-stream
 * Corpo JSON: { store_name, address?, cnpj?, lat?, lng?, category?, products?, productsText?, continueOnError? }
 * Resposta: text/event-stream (SSE) — eventos `step`, `product`, `done`, `error`.
 *
 * Auth: sessão NextAuth (user supabaseId) OU header `x-map-quick-add-secret` = MAP_QUICK_ADD_SECRET.
 */

export const config = {
  api: {
    responseLimit: false,
    bodyParser: {
      sizeLimit: '4mb',
    },
  },
};

function writeSse(res, event, payload) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
  sseTryFlushRes(res);
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

  const body = req.body || {};
  const storeNameRaw = typeof body.store_name === 'string' ? body.store_name.trim() : '';
  if (!storeNameRaw) {
    return res.status(400).json({ error: 'store_name é obrigatório.' });
  }

  const address = typeof body.address === 'string' ? body.address.trim() : '';
  const cnpjRaw = typeof body.cnpj === 'string' ? body.cnpj.trim() : '';
  const category =
    typeof body.category === 'string' && body.category.trim() ? body.category.trim() : null;
  const continueOnError = body.continueOnError !== false;

  let latIn = body.lat != null ? Number(body.lat) : NaN;
  let lngIn = body.lng != null ? Number(body.lng) : NaN;
  if (!Number.isFinite(latIn)) latIn = NaN;
  if (!Number.isFinite(lngIn)) lngIn = NaN;

  const products = parseProductsFromBody(body);
  if (!products.length) {
    return res.status(400).json({ error: 'Nenhum produto válido (products[] ou productsText).' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const send = (event, data) => writeSse(res, event, data);

  try {
    send('step', {
      id: 'parse',
      status: 'ok',
      detail: { count: products.length, auth: auth.via },
    });

    let lat = latIn;
    let lng = lngIn;

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      send('step', {
        id: 'geocode',
        status: 'ok',
        detail: { lat, lng, source: 'body' },
      });
    } else {
      send('step', { id: 'geocode', status: 'start', detail: {} });
      const q1 = address ? `${storeNameRaw}, ${address}, Brasil` : `${storeNameRaw}, Brasil`;
      let coords = await geocodeAddress(q1);
      if (!coords) coords = await geocodeAddress(`${storeNameRaw}, São Paulo, Brasil`);
      if (!coords || coords.lat == null || coords.lng == null) {
        send('step', { id: 'geocode', status: 'error', detail: { message: 'Geocoding sem resultado' } });
        send('error', { message: 'Não foi possível obter lat/lng. Informe lat/lng no JSON ou um endereço melhor.' });
        res.end();
        return;
      }
      lat = coords.lat;
      lng = coords.lng;
      send('step', {
        id: 'geocode',
        status: 'ok',
        detail: { lat, lng, source: 'mapbox' },
      });
    }

    send('step', { id: 'store_dedupe', status: 'start', detail: {} });
    const cnpjDigits = digitsOnlyCnpj(cnpjRaw);
    const { data: rpcRows, error: rpcErr } = await supabase.rpc('find_or_create_store', {
      p_name: storeNameRaw,
      p_address: address || null,
      p_lat: lat,
      p_lng: lng,
      p_cnpj: cnpjDigits.length >= 14 ? cnpjRaw : null,
    });

    if (rpcErr) {
      send('step', { id: 'store_dedupe', status: 'error', detail: { message: rpcErr.message } });
      send('error', { message: rpcErr.message || 'find_or_create_store falhou' });
      res.end();
      return;
    }

    const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
    const storeId = row?.store_id;
    if (!storeId) {
      send('step', { id: 'store_dedupe', status: 'error', detail: {} });
      send('error', { message: 'RPC não devolveu store_id' });
      res.end();
      return;
    }

    if (cnpjDigits.length >= 14) {
      await supabase.from('stores').update({ cnpj: cnpjDigits }).eq('id', storeId);
    }

    const { data: storeRow, error: storeErr } = await supabase
      .from('stores')
      .select('name')
      .eq('id', storeId)
      .maybeSingle();

    const storeNameForPoints = storeErr || !storeRow?.name ? storeNameRaw : storeRow.name;

    send('step', {
      id: 'store_dedupe',
      status: 'ok',
      detail: {
        store_id: storeId,
        created_new: row?.created_new,
        matched_by: row?.matched_by,
        store_name: storeNameForPoints,
      },
    });

    send('step', {
      id: 'thumbnails',
      status: 'pending',
      detail: { message: 'A resolver miniaturas em paralelo…' },
    });

    const thumbMemo = new Map();
    const thumbConc = getQuickAddThumbConcurrency();
    const chunkSize = getQuickAddInsertChunkSize();

    const imageUrls = await resolveQuickAddThumbnailsParallel(
      supabase,
      products,
      storeNameForPoints,
      thumbMemo,
      thumbConc,
      (done, tot) => {
        send('step', {
          id: 'thumbnails',
          status: 'pending',
          detail: { message: `Miniaturas ${done}/${tot}`, done, total: tot },
        });
      }
    );

    send('step', { id: 'thumbnails', status: 'ok', detail: {} });

    const rows = buildPricePointInsertRows(products, imageUrls, {
      userId: auth.userId,
      storeName: storeNameForPoints,
      lat,
      lng,
      category,
      source: auth.via === 'session' ? 'community_manual' : 'admin_manual',
    });

    send('step', {
      id: 'insert_prices',
      status: 'pending',
      detail: { message: `A gravar ${rows.length} preço(s) em lotes…`, chunkSize },
    });

    const ins = await insertPricePointsInChunks(supabase, rows, {
      chunkSize,
      continueOnError,
      onChunk: (upTo, totalRows) => {
        send('step', {
          id: 'insert_prices',
          status: 'pending',
          detail: { message: `Gravados ${upTo}/${totalRows}`, upTo, total: totalRows },
        });
      },
    });

    if (ins.fatal && !continueOnError) {
      for (let i = 0; i < products.length; i += 1) {
        if (ins.outcomes[i] !== 'inserted') continue;
        send('product', {
          index: i + 1,
          total: products.length,
          status: 'ok',
          name: products[i].product_name,
        });
      }
      send('error', {
        message: ins.fatal.message || 'Insert em lote falhou',
        partial: { inserted: ins.inserted, failures: ins.failures },
      });
      return;
    }

    for (let i = 0; i < products.length; i += 1) {
      const p = products[i];
      if (ins.outcomes[i] === 'inserted') {
        send('product', {
          index: i + 1,
          total: products.length,
          status: 'ok',
          name: p.product_name,
        });
      } else if (ins.outcomes[i] === 'failed') {
        const f = ins.failures.find((x) => x.index === i + 1);
        send('product', {
          index: i + 1,
          total: products.length,
          status: 'error',
          name: p.product_name,
          message: f?.message,
        });
      }
    }

    send('step', { id: 'insert_prices', status: 'ok', detail: {} });

    send('done', {
      ok: true,
      inserted: ins.inserted,
      failed: ins.failures.length,
      failures: ins.failures,
      store_id: storeId,
      store_name: storeNameForPoints,
      lat,
      lng,
    });
  } catch (e) {
    send('error', { message: e?.message || 'Erro inesperado' });
  } finally {
    res.end();
  }
}
