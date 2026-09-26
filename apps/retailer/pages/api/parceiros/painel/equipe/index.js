import { requireMerchantApi } from '../../../../../lib/merchant/requireMerchantApi';
import {
  createPinHash,
  EQUIPE_PAPEL_LABEL,
  EQUIPE_PAPEIS,
  normalizePapel,
  normalizePin,
} from '../../../../../lib/merchant/equipe/equipeAuth';

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

/** GET/POST /api/parceiros/painel/equipe — listar / cadastrar equipe (dono). */
export default async function handler(req, res) {
  const auth = await requireMerchantApi(req, res);
  if (!auth) return;

  if (auth.isEquipe) {
    return res.status(403).json({ error: 'Só o dono da loja gerencia a equipe.' });
  }

  const { supabase, store } = auth;

  if (req.method === 'GET') {
    // Garante codigo_equipe
    let codigo = store.codigo_equipe;
    if (!codigo) {
      codigo = String(store.id).replace(/-/g, '').slice(0, 6).toUpperCase();
      await supabase.from('stores').update({ codigo_equipe: codigo }).eq('id', store.id);
    }

    const { data, error } = await supabase
      .from('equipe_loja')
      .select('id, nome, papel, telefone, ativo, ultimo_acesso_em, criado_em')
      .eq('loja_id', store.id)
      .order('criado_em', { ascending: true });

    if (error) {
      if (/equipe_loja/i.test(error.message || '')) {
        return res.status(503).json({
          error: 'Tabela equipe_loja ausente. Rode a migration 20260721140000 no Supabase.',
        });
      }
      return res.status(500).json({ error: error.message });
    }

    const membros = (data || []).map(mapMembro);
    const counts = { garcom: 0, cozinha: 0, caixa: 0, total: membros.filter((m) => m.ativo).length };
    for (const m of membros) {
      if (m.ativo && counts[m.papel] != null) counts[m.papel] += 1;
    }

    return res.status(200).json({
      codigo_equipe: codigo,
      counts,
      membros,
      papeis: EQUIPE_PAPEIS.map((p) => ({ id: p, label: EQUIPE_PAPEL_LABEL[p] })),
    });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const nome = String(body.nome || '').trim().slice(0, 80);
    const papel = normalizePapel(body.papel);
    const pin = normalizePin(body.pin);
    const telefone = String(body.telefone || '').replace(/\D/g, '').slice(0, 15) || null;

    if (nome.length < 2) {
      return res.status(400).json({ error: 'Informe o nome do funcionário.' });
    }
    if (!papel) {
      return res.status(400).json({ error: 'Papel inválido. Use: garcom, cozinha ou caixa.' });
    }
    if (!pin) {
      return res.status(400).json({ error: 'PIN deve ter 4 a 6 dígitos.' });
    }

    const { salt, hash } = createPinHash(pin);
    const { data, error } = await supabase
      .from('equipe_loja')
      .insert({
        loja_id: store.id,
        nome,
        papel,
        telefone,
        pin_salt: salt,
        pin_hash: hash,
        ativo: true,
      })
      .select('id, nome, papel, telefone, ativo, ultimo_acesso_em, criado_em')
      .single();

    if (error) {
      return res.status(500).json({ error: error.message || 'Erro ao cadastrar.' });
    }

    return res.status(201).json({
      membro: mapMembro(data),
      pin_plain: pin,
      hint: 'Anote o PIN — ele não será mostrado de novo.',
    });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
