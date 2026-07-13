import { requireMerchantApi } from '../../../../lib/merchant/requireMerchantApi';

/** GET/PATCH configurações básicas de entrega (sem integrações iFood/99 — adiado). */
export default async function handler(req, res) {
  const auth = await requireMerchantApi(req, res);
  if (!auth) return;

  const { supabase, store } = auth;

  if (req.method === 'GET') {
    const { data: storeRow, error } = await supabase
      .from('stores')
      .select('delivery_manual_ativo, delivery_taxa, delivery_tempo_minutos')
      .eq('id', store.id)
      .maybeSingle();

    if (error) {
      if (/delivery_manual_ativo|delivery_taxa|delivery_tempo/i.test(error.message || '')) {
        return res.status(503).json({
          error: 'Rode a migração 20260713180000_restaurante_operacional.sql no Supabase.',
        });
      }
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({
      delivery: {
        manual_ativo: storeRow?.delivery_manual_ativo ?? false,
        taxa: Number(storeRow?.delivery_taxa ?? 0),
        tempo_minutos: storeRow?.delivery_tempo_minutos ?? 45,
      },
    });
  }

  if (req.method === 'PATCH') {
    const body = req.body || {};
    if (!body.delivery) {
      return res.status(400).json({ error: 'Campo delivery obrigatório.' });
    }

    const d = body.delivery;
    const storePatch = {};
    if (d.manual_ativo != null) storePatch.delivery_manual_ativo = Boolean(d.manual_ativo);
    if (d.taxa != null) storePatch.delivery_taxa = Math.max(0, Number(d.taxa) || 0);
    if (d.tempo_minutos != null) {
      storePatch.delivery_tempo_minutos = Math.max(
        15,
        Math.min(180, Number(d.tempo_minutos) || 45)
      );
    }

    if (!Object.keys(storePatch).length) {
      return res.status(400).json({ error: 'Nada para atualizar.' });
    }

    const { error } = await supabase.from('stores').update(storePatch).eq('id', store.id);
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ success: true });
  }

  res.setHeader('Allow', 'GET, PATCH');
  return res.status(405).json({ error: 'Method not allowed' });
}
