import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { canAccess } from '../../../lib/access-server';
import {
  hasFinmemoryAdminAllowlist,
  isFinmemoryAdminEmail,
} from '../../../lib/adminAccess';
import { geocodeAddress } from '../../../lib/geocode';
import {
  buildQuickAddPayloadFromAdminBody,
  digitsOnlyCnpj,
  getMapQuickAddSupabase,
  resolveQuickAddAuth,
} from '../../../lib/mapQuickAddCore';
import { resolveThumbnailForQuickAddInsert } from '../../../lib/mapProductImageCache';
import { sseTryFlushRes } from '../../../lib/sseTryFlushRes';

/**
 * POST /api/admin/quick-add
 * Corpo: { store: { name, address, cnpj?, lat?, lng? }, products: [{ name, price, ... }], category?, continueOnError? }
 * Stream: apenas linhas `data: {JSON}\n\n` (compatível com components/admin/QuickAdd.tsx)
 *
 * Eventos JSON: { step, status, message?, data? } onde step ∈ validate|geocode|dedup|store_insert|products|done|fatal
 */

export const config = {
  api: {
    responseLimit: false,
    bodyParser: {
      sizeLimit: '4mb',
    },
  },
};

function legacyData(res, obj) {
  res.write(`data: ${JSON.stringify(obj)}\n\n`);
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

  const payload = buildQuickAddPayloadFromAdminBody(req.body || {});
  const { store_name: storeNameRaw, address, cnpj, category, continueOnError, products } = payload;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const send = (obj) => legacyData(res, obj);

  try {
    send({ step: 'validate', status: 'pending', message: 'Validando loja e produtos…' });

    if (!storeNameRaw) {
      send({ step: 'validate', status: 'error', message: 'Nome da loja obrigatório.' });
      send({ step: 'fatal', message: 'Nome da loja obrigatório.' });
      res.end();
      return;
    }
    if (!address) {
      send({ step: 'validate', status: 'error', message: 'Endereço obrigatório (geocode).' });
      send({ step: 'fatal', message: 'Endereço obrigatório.' });
      res.end();
      return;
    }
    if (!products.length) {
      send({ step: 'validate', status: 'error', message: 'Nenhum produto válido.' });
      send({ step: 'fatal', message: 'Nenhum produto válido.' });
      res.end();
      return;
    }

    send({
      step: 'validate',
      status: 'ok',
      message: `${products.length} produto(s)`,
    });

    send({ step: 'geocode', status: 'pending', message: 'Geocoding…' });

    let lat = payload.lat;
    let lng = payload.lng;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      const q1 = `${storeNameRaw}, ${address}, Brasil`;
      let coords = await geocodeAddress(q1);
      if (!coords) coords = await geocodeAddress(`${storeNameRaw}, São Paulo, Brasil`);
      if (!coords || coords.lat == null || coords.lng == null) {
        send({ step: 'geocode', status: 'error', message: 'Geocoding sem resultado' });
        send({ step: 'fatal', message: 'Não foi possível obter lat/lng. Ajuste o endereço ou envie lat/lng no JSON da loja.' });
        res.end();
        return;
      }
      lat = coords.lat;
      lng = coords.lng;
    }

    send({
      step: 'geocode',
      status: 'ok',
      message: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    });

    send({ step: 'dedup', status: 'pending', message: 'Deduplicação de loja…' });

    const cnpjDigits = digitsOnlyCnpj(cnpj);
    const { data: rpcRows, error: rpcErr } = await supabase.rpc('find_or_create_store', {
      p_name: storeNameRaw,
      p_address: address || null,
      p_lat: lat,
      p_lng: lng,
      p_cnpj: cnpjDigits.length >= 14 ? cnpj : null,
    });

    if (rpcErr) {
      send({ step: 'dedup', status: 'error', message: rpcErr.message });
      send({ step: 'fatal', message: rpcErr.message || 'find_or_create_store falhou' });
      res.end();
      return;
    }

    const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
    const storeId = row?.store_id;
    if (!storeId) {
      send({ step: 'dedup', status: 'error', message: 'Sem store_id' });
      send({ step: 'fatal', message: 'RPC não devolveu store_id' });
      res.end();
      return;
    }

    send({
      step: 'dedup',
      status: 'ok',
      message: row?.created_new ? 'Nova loja (needs_review)' : `Match: ${row?.matched_by || '—'}`,
    });

    send({ step: 'store_insert', status: 'pending', message: 'Atualizando cadastro da loja…' });

    if (cnpjDigits.length >= 14) {
      const { error: cnpjErr } = await supabase.from('stores').update({ cnpj: cnpjDigits }).eq('id', storeId);
      if (cnpjErr) {
        send({
          step: 'store_insert',
          status: 'info',
          message: `CNPJ não gravado: ${cnpjErr.message}`,
        });
      }
    }

    const { data: storeRow, error: storeErr } = await supabase
      .from('stores')
      .select('name')
      .eq('id', storeId)
      .maybeSingle();

    const storeNameForPoints = storeErr || !storeRow?.name ? storeNameRaw : storeRow.name;

    send({
      step: 'store_insert',
      status: 'ok',
      message: storeNameForPoints,
    });

    send({ step: 'products', status: 'pending', message: 'Inserindo preços…', data: { progress: 0 } });

    let inserted = 0;
    const failures = [];
    const total = products.length;
    const thumbMemo = new Map();

    for (let i = 0; i < products.length; i += 1) {
      const p = products[i];
      const progress = Math.round(((i + 1) / total) * 100);
      send({
        step: 'products',
        status: 'pending',
        message: `${i + 1}/${total} ${p.product_name}`,
        data: { progress },
      });

      let imageUrl = null;
      try {
        imageUrl = await resolveThumbnailForQuickAddInsert(
          supabase,
          p.product_name,
          storeNameForPoints,
          thumbMemo
        );
      } catch (imgErr) {
        console.warn('admin quick-add image:', imgErr?.message || imgErr);
      }

      const { error: insErr } = await supabase.from('price_points').insert({
        user_id: auth.userId,
        product_name: p.product_name,
        price: p.price,
        store_name: storeNameForPoints,
        lat,
        lng,
        category,
        image_url: imageUrl || null,
      });

      if (insErr) {
        failures.push({ index: i + 1, name: p.product_name, message: insErr.message });
        if (!continueOnError) {
          send({ step: 'products', status: 'error', message: insErr.message });
          send({ step: 'fatal', message: insErr.message });
          res.end();
          return;
        }
      } else {
        inserted += 1;
      }
    }

    send({
      step: 'products',
      status: failures.length ? 'info' : 'ok',
      message: `${inserted} ok${failures.length ? `, ${failures.length} falha(s)` : ''}`,
      data: { progress: 100 },
    });

    send({ step: 'done' });
  } catch (e) {
    send({ step: 'fatal', message: e?.message || 'Erro inesperado' });
  } finally {
    res.end();
  }
}
