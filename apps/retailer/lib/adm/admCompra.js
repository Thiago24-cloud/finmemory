import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../pages/api/auth/[...nextauth]';
import { getSupabaseAdmin } from '../supabaseAdmin';
import { isFinmemoryAdminEmail, hasFinmemoryAdminAllowlist } from '../adminAccess';

/**
 * Garante sessão de admin FinMemory (FINMEMORY_ADMIN_EMAILS).
 * @returns {{ supabase, session, email } | null}
 */
export async function requireAdmCompraApi(req, res) {
  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;

  if (!email) {
    res.status(401).json({ error: 'Faça login para acessar o ADM FinMemory Compra.' });
    return null;
  }

  if (!hasFinmemoryAdminAllowlist()) {
    res.status(403).json({
      error:
        'Configure FINMEMORY_ADMIN_EMAILS no Cloud Run para liberar o ADM FinMemory Compra.',
    });
    return null;
  }

  if (!isFinmemoryAdminEmail(email)) {
    res.status(403).json({ error: 'Sem acesso ao ADM FinMemory Compra.' });
    return null;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    res.status(500).json({ error: 'Serviço indisponível' });
    return null;
  }

  return { supabase, session, email };
}

export const ADM_PERFIS = [
  'Ambulante',
  'Marmiteiro',
  'Doceiro',
  'Lanchonete',
  'Food truck',
  'Pequeno restaurante',
  'Padaria pequena',
  'Vendedor informal',
];

export const ADM_PLANOS = ['Teste grátis', 'Pagando', 'Inativo'];
export const ADM_STATUS = ['Ativo', 'Inativo', 'Em teste'];
export const ADM_DIAS = [
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
  'Domingo',
];

/** Normaliza telefone BR para wa.me (só dígitos, com 55 se faltar). */
export function normalizeWhatsAppDigits(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55')) return digits;
  if (digits.length >= 10 && digits.length <= 11) return `55${digits}`;
  return digits;
}

/**
 * Melhor preço recente por produto (menor preço na data mais recente disponível).
 */
export async function getBestPricesForProducts(supabase, productIds) {
  if (!productIds?.length) return new Map();

  const { data, error } = await supabase
    .from('adm_compra_prices')
    .select(
      `
      id, product_id, market_id, preco, data_preco,
      product:adm_compra_products(id, nome, unidade),
      market:adm_compra_markets(id, nome, bairro)
    `
    )
    .in('product_id', productIds)
    .order('data_preco', { ascending: false })
    .order('preco', { ascending: true });

  if (error) throw error;

  const best = new Map();
  for (const row of data || []) {
    if (best.has(row.product_id)) continue;
    best.set(row.product_id, row);
  }
  return best;
}

/**
 * Monta mensagem WhatsApp para um usuário a partir da lista + melhores preços.
 */
export function buildAlertMessage({ user, listItems, bestPrices }) {
  const nome = user?.nome || 'cliente';
  const lines = [];
  let economia = 0;

  for (const item of listItems || []) {
    const best = bestPrices.get(item.product_id);
    if (!best) continue;
    const prodName = best.product?.nome || item.product?.nome || 'Produto';
    const unit = best.product?.unidade ? ` ${best.product.unidade}` : '';
    const market = best.market?.nome || 'mercado';
    const preco = Number(best.preco);
    lines.push(`- ${prodName}${unit}: R$ ${preco.toFixed(2).replace('.', ',')} no ${market}`);
  }

  // Economia estimada: diferença vs 2º preço quando existir (simplificado: 8% do total se houver linhas)
  if (lines.length > 0) {
    let total = 0;
    for (const item of listItems || []) {
      const best = bestPrices.get(item.product_id);
      if (best) total += Number(best.preco);
    }
    economia = Math.round(total * 0.08 * 100) / 100;
  }

  const body = [
    `Olá, ${nome}! Aqui é a FinMemory.`,
    '',
    'Atualizamos os preços da sua lista de compra.',
    '',
    'Hoje encontramos:',
    '',
    ...(lines.length ? lines : ['- Ainda não há preços cadastrados para os itens da sua lista.']),
    '',
    economia > 0
      ? `Economia estimada: R$ ${economia.toFixed(2).replace('.', ',')} nessa compra.`
      : 'Assim que atualizarmos mais preços, calculamos sua economia.',
    '',
    'Quer que eu monte sua lista completa?',
  ].join('\n');

  return { mensagem: body, economia_estimada: economia, linhas: lines.length };
}
