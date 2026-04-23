import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { canAccess } from '../../../lib/access-server';
import { canAccessAdminRoutes } from '../../../lib/adminAccess';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: 'Não autenticado' });

  const allowed = await canAccessAdminRoutes(session.user.email, () =>
    canAccess(session.user.email)
  );
  if (!allowed) return res.status(403).json({ error: 'Acesso negado' });

  const supabase = getSupabaseAdmin();
  const dryRun = req.body?.dryRun === true;

  // Busca registros do bot Dia
  const { data: rows, error: fetchErr } = await supabase
    .from('price_points')
    .select('id, store_name, lat, lng, product_name, price, image_url')
    .eq('category', 'Supermercado - Promoção')
    .ilike('store_name', '%Dia%')
    .order('store_name');

  if (fetchErr) return res.status(500).json({ error: fetchErr.message });

  if (!rows || rows.length === 0) {
    return res.status(200).json({ ok: true, lojas: 0, produtos: 0, note: 'Nenhum registro encontrado' });
  }

  // Agrupa por loja
  const lojaMap = new Map();
  for (const row of rows) {
    const key = `${row.store_name}||${row.lat}||${row.lng}`;
    if (!lojaMap.has(key)) {
      lojaMap.set(key, {
        store_name: row.store_name,
        store_lat: row.lat,
        store_lng: row.lng,
        ids: [],
        produtos: [],
      });
    }
    const loja = lojaMap.get(key);
    loja.ids.push(row.id);
    loja.produtos.push({
      nome: row.product_name,
      preco: row.price != null ? Number(row.price) : null,
      imagem_url: row.image_url || null,
    });
  }

  const lojas = Array.from(lojaMap.values());

  if (dryRun) {
    return res.status(200).json({
      ok: true,
      dryRun: true,
      lojas: lojas.length,
      produtos: rows.length,
      preview: lojas.map((l) => ({ store_name: l.store_name, produtos: l.produtos.length })),
    });
  }

  // Insere na fila
  const filaRows = lojas.map((loja) => ({
    store_name: loja.store_name,
    store_address: null,
    store_lat: loja.store_lat,
    store_lng: loja.store_lng,
    produtos: loja.produtos,
    origem: 'migration_dia_legacy',
    status: 'pendente',
  }));

  const { error: insertErr } = await supabase.from('bot_promocoes_fila').insert(filaRows);
  if (insertErr) return res.status(500).json({ error: `Erro ao inserir na fila: ${insertErr.message}` });

  // Deleta de price_points em lotes
  const allIds = lojas.flatMap((l) => l.ids);
  const BATCH = 500;
  for (let i = 0; i < allIds.length; i += BATCH) {
    const { error: delErr } = await supabase
      .from('price_points')
      .delete()
      .in('id', allIds.slice(i, i + BATCH));
    if (delErr) return res.status(500).json({ error: `Erro ao deletar lote: ${delErr.message}` });
  }

  return res.status(200).json({
    ok: true,
    lojas: lojas.length,
    produtos: rows.length,
    deletados: allIds.length,
  });
}
