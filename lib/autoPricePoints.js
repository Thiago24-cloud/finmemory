import { getSupabase } from './supabase';

/**
 * Cria price_points a partir de itens de uma transação usando a geolocalização
 * do navegador (útil em lançamento manual quando o usuário está no local).
 * Se a geolocalização não estiver disponível, não insere nada.
 *
 * @param {Object} params
 * @param {string} params.userId - ID do usuário (Supabase/NextAuth)
 * @param {string} params.storeName - Nome do estabelecimento
 * @param {string} [params.category] - Categoria (ex: "Outros")
 * @param {Array<{ descricao: string, quantidade?: number, valor_total: number }>} params.items - Itens
 * @returns {Promise<boolean>} true se inseriu algo, false caso contrário
 */
export async function createPricePointsFromTransaction({ userId, storeName, category, items }) {
  if (!items?.length || !storeName) return false;

  let lat = null;
  let lng = null;

  try {
    const pos = await new Promise((resolve, reject) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        reject(new Error('Geolocation not available'));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        timeout: 5000,
        maximumAge: 300000,
      });
    });
    lat = pos.coords.latitude;
    lng = pos.coords.longitude;
  } catch {
    return false;
  }

  const points = items
    .filter((item) => item.descricao && (item.valor_total > 0 || item.valor_total === 0))
    .map((item) => ({
      user_id: userId,
      store_name: storeName,
      product_name: item.descricao,
      price: item.quantidade ? item.valor_total / item.quantidade : item.valor_total,
      lat,
      lng,
      category: category || 'Outros',
    }));

  if (points.length === 0) return false;

  const supabase = getSupabase();
  if (!supabase) return false;

  const { error } = await supabase.from('price_points').insert(points);
  if (error) {
    console.error('Error creating price points:', error);
    return false;
  }
  return true;
}
