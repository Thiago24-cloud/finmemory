import { requireMerchantApi } from '../../../../../lib/merchant/requireMerchantApi';
import { mapMesaRowToApi } from '../../../../../lib/merchant/mesas/mapMesaRow';

const MESA_SELECT = 'id, loja_id, numero, capacidade, status, observacao, created_at, updated_at';

/**
 * GET/POST /api/parceiros/painel/mesas
 */
export default async function handler(req, res) {
  const auth = await requireMerchantApi(req, res);
  if (!auth) return;

  const { supabase, store } = auth;
  const lojaId = store.id;

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('mesas_loja')
      .select(MESA_SELECT)
      .eq('loja_id', lojaId)
      .order('numero', { ascending: true });

    if (error) {
      if (/mesas_loja/i.test(error.message || '')) {
        return res.status(503).json({
          error: 'Tabela mesas_loja ausente. Execute a migração 20260713140000 no Supabase.',
        });
      }
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({
      mesas: (data || []).map(mapMesaRowToApi),
      total: (data || []).length,
    });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const numero = parseInt(String(body.numero), 10);
    const capacidade = parseInt(String(body.capacidade ?? 4), 10) || 4;

    if (!Number.isFinite(numero) || numero < 0) {
      return res.status(400).json({ error: 'Número da mesa inválido.' });
    }

    const { data: row, error } = await supabase
      .from('mesas_loja')
      .insert({
        loja_id: lojaId,
        numero,
        capacidade,
        status: 'livre',
        updated_at: new Date().toISOString(),
      })
      .select(MESA_SELECT)
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: `Mesa ${numero} já existe.` });
      }
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json({ mesa: mapMesaRowToApi(row) });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
