import { requireMerchantApi } from '../../../../../lib/merchant/requireMerchantApi';
import { mapMesaRowToApi } from '../../../../../lib/merchant/mesas/mapMesaRow';

const MESA_SELECT = 'id, loja_id, numero, capacidade, status, observacao, created_at, updated_at';

/**
 * PATCH/DELETE /api/parceiros/painel/mesas/[id]
 */
export default async function handler(req, res) {
  const auth = await requireMerchantApi(req, res);
  if (!auth) return;

  const { supabase, store } = auth;
  const id = String(req.query.id || '').trim();
  if (!id) return res.status(400).json({ error: 'ID obrigatório.' });

  const { data: existing, error: findErr } = await supabase
    .from('mesas_loja')
    .select(MESA_SELECT)
    .eq('id', id)
    .eq('loja_id', store.id)
    .maybeSingle();

  if (findErr) return res.status(500).json({ error: findErr.message });
  if (!existing) return res.status(404).json({ error: 'Mesa não encontrada.' });

  if (req.method === 'PATCH') {
    const body = req.body || {};
    const patch = { updated_at: new Date().toISOString() };

    if (body.numero != null) {
      const numero = parseInt(String(body.numero), 10);
      if (!Number.isFinite(numero) || numero < 0) {
        return res.status(400).json({ error: 'Número inválido.' });
      }
      patch.numero = numero;
    }
    if (body.capacidade != null) {
      patch.capacidade = Math.max(1, parseInt(String(body.capacidade), 10) || 4);
    }
    if (body.status) patch.status = String(body.status);
    if (body.observacao != null) patch.observacao = String(body.observacao).slice(0, 500);

    const { data: row, error } = await supabase
      .from('mesas_loja')
      .update(patch)
      .eq('id', id)
      .eq('loja_id', store.id)
      .select(MESA_SELECT)
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ mesa: mapMesaRowToApi(row) });
  }

  if (req.method === 'DELETE') {
    const { error } = await supabase.from('mesas_loja').delete().eq('id', id).eq('loja_id', store.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'PATCH, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
}
