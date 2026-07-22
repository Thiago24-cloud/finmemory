/** GET/POST /api/parceiros/adm/users — lista + cria usuários ADM Compra */
import {
  requireAdmCompraApi,
  ADM_PERFIS,
  ADM_PLANOS,
  ADM_STATUS,
  ADM_DIAS,
} from '../../../../../lib/adm/admCompra';

export default async function handler(req, res) {
  const ctx = await requireAdmCompraApi(req, res);
  if (!ctx) return;
  const { supabase } = ctx;

  if (req.method === 'GET') {
    const {
      cidade,
      bairro,
      perfil,
      dia_compra,
      status,
      plano,
      alerta_hoje,
      q,
    } = req.query;

    let query = supabase.from('adm_compra_users').select('*').order('created_at', { ascending: false });

    if (cidade) query = query.ilike('cidade', `%${String(cidade).trim()}%`);
    if (bairro) query = query.ilike('bairro', `%${String(bairro).trim()}%`);
    if (perfil) query = query.eq('perfil', String(perfil));
    if (dia_compra) query = query.eq('dia_compra', String(dia_compra));
    if (status) query = query.eq('status', String(status));
    if (plano) query = query.eq('plano', String(plano));
    if (q) {
      const raw = String(q).trim().replace(/[%_,]/g, '');
      if (raw) {
        const term = `%${raw}%`;
        query = query.or(`nome.ilike.${term},telefone.ilike.${term},produto_principal.ilike.${term}`);
      }
    }

    if (alerta_hoje === '1' || alerta_hoje === 'true') {
      const dias = [
        'Domingo',
        'Segunda-feira',
        'Terça-feira',
        'Quarta-feira',
        'Quinta-feira',
        'Sexta-feira',
        'Sábado',
      ];
      const hoje = dias[new Date().getDay()];
      query = query.eq('dia_compra', hoje).in('status', ['Ativo', 'Em teste']);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[adm/users GET]', error);
      return res.status(503).json({
        error:
          error.message?.includes('adm_compra_users') || error.code === '42P01'
            ? 'Tabela ADM ainda não criada. Execute a migration 20260722120000_adm_finmemory_compra.sql no Supabase.'
            : error.message,
      });
    }

    return res.status(200).json({
      users: data || [],
      meta: { perfis: ADM_PERFIS, planos: ADM_PLANOS, status: ADM_STATUS, dias: ADM_DIAS },
    });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const nome = String(body.nome || '').trim();
    const telefone = String(body.telefone || '').trim();
    if (!nome || !telefone) {
      return res.status(400).json({ error: 'Nome e telefone são obrigatórios.' });
    }

    const row = {
      nome,
      telefone,
      cidade: String(body.cidade || '').trim() || null,
      bairro: String(body.bairro || '').trim() || null,
      perfil: String(body.perfil || 'Ambulante').trim(),
      produto_principal: String(body.produto_principal || '').trim() || null,
      plano: String(body.plano || 'Teste grátis').trim(),
      dia_compra: String(body.dia_compra || '').trim() || null,
      status: String(body.status || 'Ativo').trim(),
      observacoes: String(body.observacoes || '').trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from('adm_compra_users').insert(row).select('*').single();
    if (error) {
      console.error('[adm/users POST]', error);
      return res.status(500).json({ error: error.message });
    }
    return res.status(201).json({ user: data });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Método não permitido' });
}
