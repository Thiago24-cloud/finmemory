import { requireMerchantApi } from '../../../../lib/merchant/requireMerchantApi';

const DEFAULT_PROVIDERS = [
  { provider: 'ifood', nome: 'iFood' },
  { provider: '99food', nome: '99Food' },
  { provider: 'keeta', nome: 'Keeta' },
  { provider: 'manual', nome: 'Entrega Manual' },
];

/** GET/PATCH configurações de entrega da loja. */
export default async function handler(req, res) {
  const auth = await requireMerchantApi(req, res);
  if (!auth) return;

  const { supabase, store } = auth;

  if (req.method === 'GET') {
    const { data: storeRow } = await supabase
      .from('stores')
      .select('delivery_manual_ativo, delivery_taxa, delivery_tempo_minutos')
      .eq('id', store.id)
      .maybeSingle();

    let { data: integrations, error: intErr } = await supabase
      .from('entregas_integracao_loja')
      .select('*')
      .eq('loja_id', store.id)
      .order('nome');

    if (intErr && /entregas_integracao_loja/i.test(intErr.message || '')) {
      return res.status(503).json({
        error: 'Rode a migração 20260713180000_restaurante_operacional.sql no Supabase.',
      });
    }

    if (!integrations?.length) {
      const seed = DEFAULT_PROVIDERS.map((p) => ({
        loja_id: store.id,
        provider: p.provider,
        nome: p.nome,
        is_active: p.provider === 'manual',
      }));
      await supabase.from('entregas_integracao_loja').upsert(seed, {
        onConflict: 'loja_id,provider',
        ignoreDuplicates: true,
      });
      const { data: seeded } = await supabase
        .from('entregas_integracao_loja')
        .select('*')
        .eq('loja_id', store.id)
        .order('nome');
      integrations = seeded || [];
    }

    return res.status(200).json({
      delivery: {
        manual_ativo: storeRow?.delivery_manual_ativo ?? false,
        taxa: Number(storeRow?.delivery_taxa ?? 0),
        tempo_minutos: storeRow?.delivery_tempo_minutos ?? 45,
      },
      integrations: integrations || [],
    });
  }

  if (req.method === 'PATCH') {
    const body = req.body || {};
    const patch = { updated_at: new Date().toISOString() };

    if (body.delivery) {
      const d = body.delivery;
      const storePatch = {};
      if (d.manual_ativo != null) storePatch.delivery_manual_ativo = Boolean(d.manual_ativo);
      if (d.taxa != null) storePatch.delivery_taxa = Math.max(0, Number(d.taxa) || 0);
      if (d.tempo_minutos != null) {
        storePatch.delivery_tempo_minutos = Math.max(15, Math.min(180, Number(d.tempo_minutos) || 45));
      }
      if (Object.keys(storePatch).length) {
        const { error } = await supabase.from('stores').update(storePatch).eq('id', store.id);
        if (error) return res.status(500).json({ error: error.message });
      }
    }

    if (body.integration?.id) {
      const i = body.integration;
      const intPatch = { updated_at: new Date().toISOString() };
      if (i.is_active != null) intPatch.is_active = Boolean(i.is_active);
      if (i.merchant_id != null) intPatch.merchant_id = String(i.merchant_id).slice(0, 120);
      if (i.client_id != null) intPatch.client_id = String(i.client_id).slice(0, 120);
      if (i.nome != null) intPatch.nome = String(i.nome).slice(0, 80);

      const { error } = await supabase
        .from('entregas_integracao_loja')
        .update(intPatch)
        .eq('id', i.id)
        .eq('loja_id', store.id);
      if (error) return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true });
  }

  res.setHeader('Allow', 'GET, PATCH');
  return res.status(405).json({ error: 'Method not allowed' });
}
