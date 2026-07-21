import { serialize } from 'cookie';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import {
  EQUIPE_COOKIE,
  normalizePin,
  normalizeStoreCode,
  signEquipeToken,
  verifyPin,
} from '../../../../lib/merchant/equipe/equipeAuth';

/** POST /api/parceiros/equipe/login — código da loja + PIN */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const codigo = normalizeStoreCode(req.body?.codigo_loja || req.body?.codigo || req.body?.storeCode);
  const pin = normalizePin(req.body?.pin);
  if (!codigo || codigo.length < 4) {
    return res.status(400).json({ error: 'Informe o código da loja.' });
  }
  if (!pin) {
    return res.status(400).json({ error: 'PIN inválido (4 a 6 dígitos).' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Serviço indisponível' });

  const { data: store, error: storeErr } = await supabase
    .from('stores')
    .select('id, name, codigo_equipe')
    .eq('codigo_equipe', codigo)
    .maybeSingle();

  if (storeErr) {
    if (/codigo_equipe/i.test(storeErr.message || '')) {
      return res.status(503).json({
        error: 'Migration da equipe ainda não aplicada no banco.',
      });
    }
    return res.status(500).json({ error: storeErr.message });
  }
  if (!store) {
    return res.status(401).json({ error: 'Código da loja não encontrado.' });
  }

  const { data: membros, error: eqErr } = await supabase
    .from('equipe_loja')
    .select('id, nome, papel, pin_salt, pin_hash, ativo')
    .eq('loja_id', store.id)
    .eq('ativo', true);

  if (eqErr) {
    return res.status(503).json({
      error: 'Tabela equipe_loja ausente. Peça ao dono rodar a migration.',
    });
  }

  const membro = (membros || []).find((m) => verifyPin(pin, m.pin_salt, m.pin_hash));
  if (!membro) {
    return res.status(401).json({ error: 'PIN incorreto.' });
  }

  await supabase
    .from('equipe_loja')
    .update({ ultimo_acesso_em: new Date().toISOString() })
    .eq('id', membro.id);

  const token = signEquipeToken({
    equipeId: membro.id,
    lojaId: store.id,
    papel: membro.papel,
    nome: membro.nome,
  });

  const secure = process.env.NODE_ENV === 'production';
  res.setHeader(
    'Set-Cookie',
    serialize(EQUIPE_COOKIE, token, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 12,
    })
  );

  return res.status(200).json({
    ok: true,
    membro: {
      id: membro.id,
      nome: membro.nome,
      papel: membro.papel,
    },
    store: { id: store.id, name: store.name, codigo_equipe: store.codigo_equipe },
    redirect: '/parceiros/equipe',
  });
}
