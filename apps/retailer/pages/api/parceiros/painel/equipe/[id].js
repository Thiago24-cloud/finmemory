import { requireMerchantApi } from '../../../../../../lib/merchant/requireMerchantApi';
import {
  createPinHash,
  normalizePapel,
  normalizePin,
  EQUIPE_PAPEL_LABEL,
} from '../../../../../../lib/merchant/equipe/equipeAuth';

function mapMembro(row) {
  return {
    id: row.id,
    nome: row.nome,
    papel: row.papel,
    papel_label: EQUIPE_PAPEL_LABEL[row.papel] || row.papel,
    telefone: row.telefone || null,
    ativo: row.ativo !== false,
    ultimo_acesso_em: row.ultimo_acesso_em || null,
    criado_em: row.criado_em,
  };
}

/** PATCH/DELETE /api/parceiros/painel/equipe/[id] */
export default async function handler(req, res) {
  const auth = await requireMerchantApi(req, res);
  if (!auth) return;
  if (auth.isEquipe) {
    return res.status(403).json({ error: 'Só o dono da loja gerencia a equipe.' });
  }

  const id = String(req.query.id || '');
  if (!id) return res.status(400).json({ error: 'id obrigatório' });

  const { supabase, store } = auth;

  if (req.method === 'DELETE') {
    const { error } = await supabase
      .from('equipe_loja')
      .delete()
      .eq('id', id)
      .eq('loja_id', store.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  if (req.method === 'PATCH') {
    const body = req.body || {};
    const patch = { atualizado_em: new Date().toISOString() };

    if (body.nome != null) {
      const nome = String(body.nome).trim().slice(0, 80);
      if (nome.length < 2) return res.status(400).json({ error: 'Nome inválido.' });
      patch.nome = nome;
    }
    if (body.papel != null) {
      const papel = normalizePapel(body.papel);
      if (!papel) return res.status(400).json({ error: 'Papel inválido.' });
      patch.papel = papel;
    }
    if (body.telefone != null) {
      patch.telefone = String(body.telefone).replace(/\D/g, '').slice(0, 15) || null;
    }
    if (body.ativo != null) {
      patch.ativo = Boolean(body.ativo);
    }
    if (body.pin != null && String(body.pin).trim() !== '') {
      const pin = normalizePin(body.pin);
      if (!pin) return res.status(400).json({ error: 'PIN deve ter 4 a 6 dígitos.' });
      const { salt, hash } = createPinHash(pin);
      patch.pin_salt = salt;
      patch.pin_hash = hash;
    }

    const { data, error } = await supabase
      .from('equipe_loja')
      .update(patch)
      .eq('id', id)
      .eq('loja_id', store.id)
      .select('id, nome, papel, telefone, ativo, ultimo_acesso_em, criado_em')
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Funcionário não encontrado.' });
    return res.status(200).json({ membro: mapMembro(data) });
  }

  res.setHeader('Allow', 'PATCH, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
}
