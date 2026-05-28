import {
  splitProdutosByPublishReadiness,
  normalizeQueuedProduto,
} from '../promoQueueProcessing.js';
import { resolveOwnerUserId } from '../botPromoOwner.js';
import { afterMapPricePointsInsert } from '../catalog/afterMapPricePointsInsert.js';

function toIsoDateOnly(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function inferScope(item, produtoRaw) {
  return (
    produtoRaw?.locality_scope ||
    item?.locality_scope ||
    produtoRaw?.escopo_localidade ||
    'Estadual'
  );
}

function inferCity(item, produtoRaw) {
  return produtoRaw?.locality_city || item?.locality_city || produtoRaw?.cidade || null;
}

function inferRegion(item, produtoRaw) {
  return produtoRaw?.locality_region || item?.locality_region || null;
}

export async function autoPublishQueueItem(supabase, queueRow, options = {}) {
  if (!queueRow?.id) return { ok: false, error: 'queueRow.id ausente' };

  const produtos = Array.isArray(queueRow.produtos) ? queueRow.produtos : [];
  const normalized = produtos.map((p) => normalizeQueuedProduto(p));
  const publishable = normalized.filter((p) => Number.isFinite(p.price) && p.price > 0);
  const split = splitProdutosByPublishReadiness(produtos);
  if (!publishable.length) {
    return { ok: false, error: 'Nenhum produto publicável (preço válido)' };
  }

  const ownerUserId = await resolveOwnerUserId(supabase, options.reviewerEmail || null);
  if (!ownerUserId) {
    return { ok: false, error: 'Não foi possível resolver owner user_id para publicação automática' };
  }

  const now = new Date().toISOString();
  const defaultExpiry = toIsoDateOnly(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const rows = publishable.map((p) => {
    const raw = p.raw || {};
    const isStatewide = Boolean(raw.is_statewide || queueRow.is_statewide || inferScope(queueRow, raw) === 'Estadual');
    return {
      user_id: ownerUserId,
      store_name: queueRow.store_name,
      lat: queueRow.store_lat,
      lng: queueRow.store_lng,
      product_name: p.name,
      price: Number(p.price),
      image_url: p.image_url || null,
      category: 'Supermercado - Promoção',
      source: queueRow.origem || 'scraper_auto',
      created_at: now,
      atualizado_em: now,
      locality_scope: isStatewide ? 'Estadual' : inferScope(queueRow, raw),
      locality_city: isStatewide ? null : inferCity(queueRow, raw),
      locality_region: isStatewide ? null : inferRegion(queueRow, raw),
      locality_state: queueRow.locality_state || 'SP',
      ddd_code: queueRow.ddd_code || raw.ddd_code || null,
      is_statewide: isStatewide,
      expires_at: toIsoDateOnly(p.valid_until || raw.valid_until || raw.validade || raw.expiry_date) || defaultExpiry,
    };
  });

  const { error: insertErr } = await supabase.from('price_points').insert(rows);
  if (insertErr) {
    return { ok: false, error: insertErr.message };
  }

  afterMapPricePointsInsert({
    rows,
    storeName: queueRow.store_name,
    source: queueRow.origem || 'scraper_auto',
  });

  const { error: updateErr } = await supabase
    .from('bot_promocoes_fila')
    .update({
      status: 'aprovado',
      reviewed_at: now,
      reviewed_by: options.reviewerEmail || 'scraper-auto',
    })
    .eq('id', queueRow.id);

  if (updateErr) {
    return { ok: false, error: updateErr.message };
  }

  return { ok: true, inserted: rows.length };
}
