import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { getSupabaseAdmin } from '../../lib/supabaseAdmin';

function isMissingTable(errMsg) {
  return /does not exist|relation.*not found|undefined table/i.test(errMsg || '');
}

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.supabaseId;
  if (!userId) return res.status(401).json({ success: false, error: 'Não autenticado' });

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ success: false, error: 'Serviço indisponível' });

  if (req.method === 'GET') {
    const { month } = req.query;

    try {
      const { data: cobrancas, error: cErr } = await supabase
        .from('cobrancas')
        .select('id, user_id, titulo, valor, dia_vencimento, categoria, recorrencia, ativa, created_at')
        .eq('user_id', userId)
        .eq('ativa', true);

      if (cErr) {
        if (isMissingTable(cErr.message)) {
          return res.status(200).json({ success: true, cobrancas: [], pagamentos: [] });
        }
        throw cErr;
      }

      let pagamentos = [];
      if (month && (cobrancas?.length ?? 0) > 0) {
        const parts = String(month).split('-');
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        if (!Number.isNaN(y) && !Number.isNaN(m)) {
          const lastDay = new Date(y, m, 0).getDate();
          const monthStart = `${parts[0]}-${parts[1]}-01`;
          const monthEnd = `${parts[0]}-${parts[1]}-${String(lastDay).padStart(2, '0')}`;

          const { data: pags, error: pErr } = await supabase
            .from('cobrancas_pagamentos')
            .select('id, cobranca_id, competencia, forma_pagamento, obs, created_at')
            .eq('user_id', userId)
            .gte('competencia', monthStart)
            .lte('competencia', monthEnd);

          if (!pErr) pagamentos = pags || [];
          else if (!isMissingTable(pErr.message)) throw pErr;
        }
      }

      return res.status(200).json({ success: true, cobrancas: cobrancas || [], pagamentos });
    } catch (e) {
      console.error('[api/cobrancas GET]', e?.message || e);
      return res.status(500).json({ success: false, error: e?.message || 'Erro ao carregar cobranças' });
    }
  }

  if (req.method === 'POST') {
    const { titulo, valor, dia_vencimento, categoria, recorrencia } = req.body || {};

    if (!titulo || !valor || !dia_vencimento) {
      return res.status(400).json({ success: false, error: 'Campos obrigatórios: titulo, valor, dia_vencimento' });
    }

    try {
      const { data, error } = await supabase
        .from('cobrancas')
        .insert({
          user_id: userId,
          titulo: String(titulo).trim(),
          valor: Number(valor),
          dia_vencimento: Number(dia_vencimento),
          categoria: String(categoria || 'Servicos').trim(),
          recorrencia: String(recorrencia || 'mensal').trim(),
          ativa: true,
        })
        .select()
        .single();

      if (error) {
        if (isMissingTable(error.message)) {
          return res.status(503).json({
            success: false,
            error: 'Funcionalidade de cobranças ainda não habilitada',
            hint: 'Execute as migrations para criar a tabela cobrancas',
          });
        }
        throw error;
      }

      return res.status(201).json({ success: true, cobranca: data });
    } catch (e) {
      console.error('[api/cobrancas POST]', e?.message || e);
      return res.status(500).json({ success: false, error: e?.message || 'Erro ao criar cobrança' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
