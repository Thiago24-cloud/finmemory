/**
 * POST /api/categorizar-nfce
 *
 * Sugere categoria para os dados da NFC-e usando OpenAI.
 * Body: { estabelecimento, itens[], total }
 * Retorno: { category }
 */

import OpenAI from 'openai';

let openaiInstance = null;

function getOpenAI() {
  if (!openaiInstance) {
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY não configurada');
      return null;
    }
    openaiInstance = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiInstance;
}

const CATEGORIAS = [
  'Alimentação',
  'Transporte',
  'Saúde',
  'Educação',
  'Lazer',
  'Moradia',
  'Compras',
  'Serviços',
  'Outros'
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const openai = getOpenAI();
  if (!openai) {
    return res.status(500).json({ error: 'Configuração do servidor incompleta (OpenAI)' });
  }

  try {
    const { estabelecimento, itens = [], total } = req.body || {};
    const nomeEstab = typeof estabelecimento === 'object' && estabelecimento?.nome
      ? estabelecimento.nome
      : (estabelecimento || '');
    const descricaoItens = Array.isArray(itens)
      ? itens.map((i) => `${i.name || ''} R$ ${Number(i.price || 0).toFixed(2)}`).join(', ')
      : '';

    const prompt = `Com base no estabelecimento e nos itens da nota, responda APENAS com UMA das categorias da lista, sem explicação.
Estabelecimento: ${nomeEstab}
Itens: ${descricaoItens || 'Não informado'}
Valor total: R$ ${total != null ? Number(total).toFixed(2) : '?'}

Categorias permitidas (responda só o nome): ${CATEGORIAS.join(', ')}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 50,
      temperature: 0.1
    });

    const raw = (completion.choices[0]?.message?.content || '').trim();
    const suggested = CATEGORIAS.find(
      (c) => c.toLowerCase() === raw.toLowerCase() || raw.toLowerCase().includes(c.toLowerCase())
    ) || 'Outros';

    return res.status(200).json({ category: suggested });
  } catch (err) {
    console.error('categorizar-nfce error:', err);
    return res.status(200).json({ category: 'Outros' });
  }
}
