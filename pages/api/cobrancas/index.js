import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

let supabaseInstance = null;

function getSupabaseAdmin() {
  if (!supabaseInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    supabaseInstance = createClient(url, key);
  }
  return supabaseInstance;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function monthBounds(ym) {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) {
    const now = new Date();
    ym = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
  }
  const [y, m] = ym.split('-').map(Number);
  const monthIndex = (m || 1) - 1;
  const lastDay = new Date(y, monthIndex + 1, 0).getDate();
  const monthStart = `${y}-${pad2(m)}-01`;
  const monthEnd = `${y}-${pad2(m)}-${pad2(lastDay)}`;
  return { monthStart, monthEnd };
}

/**
 * GET  /api/cobrancas?month=YYYY-MM — lista cobranças + pagamentos do mês
 * POST /api/cobrancas — cria cobrança mensal (user_id = sessão)
 */
export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.supabaseId;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Faça login para usar cobranças do mês.' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Configuração do servidor incompleta (Supabase).' });
  }

  const { data: userRow, error: userErr } = await supabase.from('users').select('id').eq('id', userId).single();
  if (userErr || !userRow) {
    return res.status(404).json({ success: false, error: 'Usuário não encontrado no banco.' });
  }

  if (req.method === 'GET') {
    const month = typeof req.query.month === 'string' ? req.query.month : null;
    const { monthStart, monthEnd } = monthBounds(month);

    try {
      const { data: cobrancasData, error: cobrancasErr } = await supabase
        .from('cobrancas')
        .select('id, titulo, valor, recorrencia, dia_vencimento, competencia, categoria, ativa, created_at')
        .eq('user_id', userId)
        .eq('ativa', true)
        .order('created_at', { ascending: false });

      if (cobrancasErr) throw cobrancasErr;

      const { data: pagamentosData, error: pagamentosErr } = await supabase
        .from('cobrancas_pagamentos')
        .select('id, cobranca_id, competencia, data_pagamento, forma_pagamento, obs')
        .eq('user_id', userId)
        .gte('competencia', monthStart)
        .lte('competencia', monthEnd);

      if (pagamentosErr) throw pagamentosErr;

      return res.status(200).json({
        success: true,
        cobrancas: Array.isArray(cobrancasData) ? cobrancasData : [],
        pagamentos: Array.isArray(pagamentosData) ? pagamentosData : [],
      });
    } catch (e) {
      console.error('[api/cobrancas GET]', e);
      return res.status(500).json({
        success: false,
        error: e?.message || 'Erro ao carregar cobranças',
        hint: 'Confira se as tabelas cobrancas e cobrancas_pagamentos existem no Supabase (migrações).',
      });
    }
  }

  if (req.method === 'POST') {
    const {
      titulo,
      valor,
      dia_vencimento,
      categoria,
      recorrencia = 'mensal',
    } = req.body || {};

    const t = String(titulo || '').trim();
    if (!t) {
      return res.status(400).json({ success: false, error: 'Informe o título.' });
    }

    const v = Number(valor);
    if (!Number.isFinite(v) || v <= 0) {
      return res.status(400).json({ success: false, error: 'Informe um valor válido.' });
    }

    const dia = Number(dia_vencimento) || 2;
    const rec = recorrencia === 'unica' ? 'unica' : 'mensal';

    const payload = {
      user_id: userId,
      titulo: t,
      valor: v,
      recorrencia: rec,
      dia_vencimento: dia,
      competencia: null,
      categoria: String(categoria || '').trim() || 'Servicos',
      ativa: true,
    };

    try {
      const { data: inserted, error: insertErr } = await supabase.from('cobrancas').insert(payload).select('id').single();
      if (insertErr) throw insertErr;
      return res.status(200).json({ success: true, id: inserted?.id });
    } catch (e) {
      console.error('[api/cobrancas POST]', e);
      return res.status(500).json({
        success: false,
        error: e?.message || 'Erro ao salvar cobrança',
        hint:
          e?.code === '23503'
            ? 'user_id precisa existir em public.users. Rode a migração cobrancas_fk_public_users no Supabase ou peça suporte.'
            : undefined,
      });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ success: false, error: 'Método não permitido' });
}
