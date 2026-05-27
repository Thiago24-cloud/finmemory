/**
 * Agrupa rótulos crus (Pluggy em inglês, variações) numa categoria legível em PT-BR
 * para relatórios e lista de categorias — sem alterar dados no banco.
 */

/** @param {string} s */
function asciiKey(s) {
  return String(s || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[''′]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Mapa exato (chave normalizada) → rótulo PT */
const EXACT = new Map(
  Object.entries({
    outros: 'Outros',
    other: 'Outros',
    'credit card payment': 'Pagamento de cartão',
    'credit card': 'Cartão de crédito',
    'card payment': 'Pagamento de cartão',
    'loans and financing': 'Empréstimos e financiamento',
    loans: 'Empréstimos',
    financing: 'Financiamento',
    investments: 'Investimentos',
    investment: 'Investimentos',
    transfers: 'Transferências',
    transfer: 'Transferências',
    'transfer - ted': 'Transferências',
    'transfer - pix': 'Transferências',
    'transfer - doc': 'Transferências',
    'transfer - internal': 'Transferências',
    'same person transfer': 'Transferências',
    'bank slip': 'Boleto',
    'bank fees': 'Tarifas bancárias',
    fees: 'Tarifas',
    utilities: 'Contas (água, luz, etc.)',
    entertainment: 'Entretenimento',
    groceries: 'Supermercado',
    food: 'Alimentação',
    restaurants: 'Restaurantes',
    transportation: 'Transporte',
    health: 'Saúde',
    education: 'Educação',
    shopping: 'Compras',
    services: 'Serviços',
    insurance: 'Seguros',
    taxes: 'Impostos',
    income: 'Rendimentos',
    salary: 'Salário',
    'automatic debit': 'Débito automático',
    'cash withdrawal': 'Saque',
    atm: 'Saque',
  })
);

/**
 * @param {string | null | undefined} raw Valor de `transacoes.categoria` ou equivalente
 * @returns {string} Rótulo para UI (relatórios / categorias)
 */
export function displayCategoryForReport(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return 'Sem categoria';

  const key = asciiKey(trimmed);
  if (EXACT.has(key)) return EXACT.get(key);

  // Heurísticas Pluggy / Open Finance (inglês fragmentado)
  if (/\btransfer\b/.test(key)) return 'Transferências';
  if (key.includes('pix') && (key.includes('envio') || key.includes('receb') || key.includes('transfer')))
    return 'Transferências';
  if (key.includes('same person') || key.includes('mesma titularidade') || key.includes('entre contas'))
    return 'Transferências';

  if (key.includes('credit card') || key.includes('cartao de credito') || key.includes('cartão de crédito'))
    return key.includes('payment') || key.includes('pagamento') ? 'Pagamento de cartão' : 'Cartão de crédito';

  if (key.includes('loan') || key.includes('financ') || key.includes('emprestimo') || key.includes('empréstimo'))
    return 'Empréstimos e financiamento';

  if (key.includes('invest')) return 'Investimentos';

  // Já está em português ou categoria custom do usuário
  return trimmed;
}
