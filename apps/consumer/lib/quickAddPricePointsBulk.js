/**
 * Quick Add em volume: miniaturas em paralelo + insert em lote no price_points.
 */

import { resolveThumbnailForQuickAddInsert } from './mapProductImageCache';

export function getQuickAddThumbConcurrency() {
  const n = Number.parseInt(process.env.QUICK_ADD_THUMB_CONCURRENCY || '6', 10);
  return Math.max(1, Math.min(16, Number.isFinite(n) ? n : 6));
}

export function getQuickAddInsertChunkSize() {
  const n = Number.parseInt(process.env.QUICK_ADD_INSERT_CHUNK_SIZE || '80', 10);
  return Math.max(5, Math.min(500, Number.isFinite(n) ? n : 80));
}

/**
 * Resolve image_url por índice; workers em paralelo com memo partilhado.
 * @param {(done: number, total: number) => void} [onProgress]
 */
export async function resolveQuickAddThumbnailsParallel(
  supabase,
  products,
  storeName,
  thumbMemo,
  concurrency,
  onProgress
) {
  const urls = new Array(products.length).fill(null);
  let nextIndex = 0;
  let completed = 0;
  const total = products.length;
  const conc = Math.max(1, Math.min(16, concurrency || 6));

  async function worker() {
    for (;;) {
      const i = nextIndex;
      nextIndex += 1;
      if (i >= total) return;
      try {
        urls[i] = await resolveThumbnailForQuickAddInsert(
          supabase,
          products[i].product_name,
          storeName,
          thumbMemo
        );
      } catch (e) {
        console.warn('quickAddPricePointsBulk thumb:', e?.message || e);
        urls[i] = null;
      }
      completed += 1;
      if (typeof onProgress === 'function') onProgress(completed, total);
    }
  }

  const nWorkers = Math.min(conc, Math.max(1, total));
  await Promise.all(Array.from({ length: nWorkers }, () => worker()));
  return urls;
}

export function buildPricePointInsertRows(products, imageUrls, ctx) {
  const { userId, storeName, lat, lng, category, source = 'admin_manual' } = ctx;
  return products.map((p, i) => ({
    user_id: userId,
    product_name: p.product_name,
    price: p.price,
    store_name: storeName,
    lat,
    lng,
    category: category ?? null,
    image_url: imageUrls[i] || null,
    source,
  }));
}

/**
 * Insert em chunks; se um chunk falhar e continueOnError, faz insert linha a linha nesse chunk.
 * @returns {{ inserted: number, failures: Array<{ index: number, name: string, message: string }>, fatal: object|null, outcomes: ('pending'|'inserted'|'failed')[] }}
 */
export async function insertPricePointsInChunks(supabase, rows, options) {
  const chunkSize = options.chunkSize || getQuickAddInsertChunkSize();
  const continueOnError = Boolean(options.continueOnError);
  const onChunk = options.onChunk;

  let inserted = 0;
  const failures = [];
  const outcomes = new Array(rows.length).fill('pending');

  for (let start = 0; start < rows.length; start += chunkSize) {
    const batch = rows.slice(start, start + chunkSize);
    const { error } = await supabase.from('price_points').insert(batch);

    if (!error) {
      for (let k = 0; k < batch.length; k += 1) {
        outcomes[start + k] = 'inserted';
      }
      inserted += batch.length;
      if (typeof onChunk === 'function') onChunk(start + batch.length, rows.length);
      continue;
    }

    if (!continueOnError) {
      return {
        inserted,
        failures,
        fatal: error,
        fatalAt: start,
        outcomes,
      };
    }

    for (let j = 0; j < batch.length; j += 1) {
      const row = batch[j];
      const idx = start + j;
      const globalIndex = idx + 1;
      const { error: rowErr } = await supabase.from('price_points').insert(row);
      if (rowErr) {
        outcomes[idx] = 'failed';
        failures.push({
          index: globalIndex,
          name: row.product_name,
          message: rowErr.message,
        });
      } else {
        outcomes[idx] = 'inserted';
        inserted += 1;
      }
    }
    if (typeof onChunk === 'function') onChunk(start + batch.length, rows.length);
  }

  return { inserted, failures, fatal: null, fatalAt: null, outcomes };
}
