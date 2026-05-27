import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.supabaseId;
  if (!userId) return res.status(401).json({ success: false, error: 'Não autenticado' });

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ success: false, error: 'Serviço indisponível' });

  const { cobranca_id, competencia, forma_pagamento, obs } = req.body || {};

  if (!cobranca_id || !competencia) {
    return res.status(400).json({ success: false, error: 'Campos obrigatórios: cobranca_id, competencia' });
  }

  try {
    const { data, error } = await supabase
      .from('cobrancas_pagamentos')
      .upsert(
        {
          user_id: userId,
          cobranca_id,
          competencia,
          forma_pagamento: forma_pagamento || null,
          obs: obs || null,
        },
        { onConflict: 'cobranca_id,competencia' }
      )
      .select()
      .single();

    if (error) {
      if (/does not exist|relation.*not found|undefined table/i.test(error.message || '')) {
        return res.status(503).json({
          success: false,
          error: 'Funcionalidade de cobranças ainda não habilitada',
          hint: 'Execute as migrations para criar a tabela cobrancas_pagamentos',
        });
      }
      throw error;
    }

    return res.status(200).json({ success: true, pagamento: data });
  } catch (e) {
    console.error('[api/cobrancas/pagamento]', e?.message || e);
    return res.status(500).json({ success: false, error: e?.message || 'Erro ao registrar pagamento' });
  }
}
