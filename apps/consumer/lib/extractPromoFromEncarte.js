import { enqueueEncarte } from './encarte-queue';

/**
 * Enfileira imagem de encarte para extração assíncrona (fila → POST /api/encarte/extract).
 * A extração Vision e inserção em `promotions` são feitas pelo worker da fila.
 *
 * @param {string} imageUrl URL https:// da imagem ou data:image/...;base64,...
 * @param {string} storeName Nome da loja (validação; gravado a partir de `stores` no worker)
 * @param {string} [storeId] UUID em public.stores — obrigatório
 * @param {'scraper'|'instagram'|'manual'} [source]
 * @returns {Promise<{ ok: true, queued: true, queueId: string } | { ok: false, error: string }>}
 */
export async function extractPromoFromEncarte(imageUrl, storeName, storeId = null, source = 'manual') {
  const url = imageUrl != null ? String(imageUrl).trim() : '';
  const store = storeName != null ? String(storeName).trim().slice(0, 200) : '';

  if (!url) {
    return { ok: false, error: 'imageUrl é obrigatório' };
  }
  if (!store) {
    return { ok: false, error: 'storeName é obrigatório' };
  }
  const sid = storeId != null ? String(storeId).trim() : '';
  if (!sid) {
    return { ok: false, error: 'storeId é obrigatório para a fila de encartes' };
  }

  try {
    const row = await enqueueEncarte({
      storeId: sid,
      imageUrl: url,
      source: source || 'manual',
    });
    return { ok: true, queued: true, queueId: row.id };
  } catch (e) {
    return { ok: false, error: e?.message || 'Falha ao enfileirar encarte' };
  }
}
