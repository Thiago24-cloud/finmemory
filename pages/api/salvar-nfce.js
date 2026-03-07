/**
 * POST /api/salvar-nfce
 *
 * Salva a NFC-e processada na tabela transacoes (schema transacoes).
 * Body: userId, estabelecimento, endereco, cnpj, data, total, itens, category, forma_pagamento, nfce_url
 * Autenticação: session NextAuth; userId deve coincidir com session.user.supabaseId.
 */

import { getServerSession } from 'next-auth/next';
import { createClient } from '@supabase/supabase-js';
import { authOptions } from './auth/[...nextauth]';

let supabaseInstance = null;

function getSupabase() {
  if (!supabaseInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    supabaseInstance = createClient(url, key);
  }
  return supabaseInstance;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ success: false, error: 'Não autorizado' });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Configuração do servidor incompleta' });
  }

  try {
    const {
      userId,
      estabelecimento,
      endereco,
      cnpj,
      data,
      total,
      itens,
      category,
      forma_pagamento,
      nfce_url
    } = req.body || {};

    const effectiveUserId = userId || session.user?.supabaseId;
    if (!effectiveUserId) {
      return res.status(400).json({ success: false, error: 'userId é obrigatório' });
    }
    if (session.user?.supabaseId && effectiveUserId !== session.user.supabaseId) {
      return res.status(403).json({ success: false, error: 'Usuário não autorizado' });
    }

    const nomeEstab = typeof estabelecimento === 'object' && estabelecimento?.nome
      ? estabelecimento.nome
      : (estabelecimento || '').trim();
    const enderecoRaw = typeof estabelecimento === 'object' && estabelecimento?.endereco
      ? estabelecimento.endereco
      : endereco;
    const enderecoFinal = enderecoRaw ? String(enderecoRaw).trim() : '';
    const nomeEstabFinal = nomeEstab && nomeEstab.length >= 2
      ? nomeEstab
      : 'Estabelecimento não identificado';

    const totalNum = total != null ? parseFloat(total) : NaN;
    if (isNaN(totalNum) || totalNum <= 0) {
      return res.status(400).json({ success: false, error: 'Valor total inválido' });
    }

    const dataTransacao = (data && String(data).trim())
      ? String(data).trim().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('id', effectiveUserId)
      .single();

    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
    }

    const transactionData = {
      user_id: effectiveUserId,
      estabelecimento: nomeEstabFinal,
      endereco: enderecoFinal || null,
      cnpj: cnpj || null,
      data: dataTransacao,
      total: totalNum,
      forma_pagamento: forma_pagamento || null,
      categoria: category || null,
      items: Array.isArray(itens) && itens.length > 0 ? itens : null,
      source: 'nfce_scan',
      receipt_image_url: nfce_url || null
    };

    const { data: transaction, error: insertError } = await supabase
      .from('transacoes')
      .insert(transactionData)
      .select()
      .single();

    if (insertError) {
      console.error('salvar-nfce insert error:', insertError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao salvar transação',
        details: insertError.message
      });
    }

    return res.status(200).json({
      success: true,
      transaction: {
        id: transaction.id,
        estabelecimento: transaction.estabelecimento,
        total: transaction.total,
        data: transaction.data,
        source: transaction.source
      }
    });
  } catch (err) {
    console.error('salvar-nfce error:', err);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao salvar NFC-e',
      details: err.message
    });
  }
}
