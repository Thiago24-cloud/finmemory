import { XMLParser } from 'fast-xml-parser';

function parseMoney(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const cleaned = String(value).replace(/[^\d,.-]/g, '');
  if (!cleaned) return null;
  const normalized =
    cleaned.includes(',') && cleaned.includes('.')
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCnpj(value) {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '');
  if (digits.length !== 14) return String(value).trim();
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function formatCep(value) {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '');
  if (digits.length !== 8) return String(value).trim();
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function normalizeText(value) {
  if (!value) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function buildAddress({ logradouro, numero, complemento, bairro, cidade, estado, cep }) {
  const street = normalizeText([logradouro, numero].filter(Boolean).join(' '));
  const cityState = normalizeText([cidade, estado].filter(Boolean).join(' - '));
  const formattedCep = formatCep(cep);
  const parts = [street, complemento, bairro, cityState, formattedCep].map(normalizeText).filter(Boolean);
  return parts.join(', ');
}

function paymentLabelFromCode(code) {
  const c = String(code || '').padStart(2, '0');
  const map = {
    '01': 'Dinheiro',
    '02': 'Cheque',
    '03': 'Cartão de Crédito',
    '04': 'Débito',
    '05': 'Crédito Loja',
    '10': 'Vale Alimentação',
    '11': 'Vale Refeição',
    '12': 'Vale Presente',
    '13': 'Vale Combustível',
    '15': 'Boleto',
    '16': 'Depósito',
    '17': 'PIX',
    '18': 'Transferência',
    '19': 'FIDIC',
    '90': 'Sem pagamento',
    '99': 'Outros',
  };
  return map[c] || '';
}

function extractPayment(infNFe) {
  const pagRoot = infNFe?.pag;
  const detPag = pagRoot?.detPag ?? pagRoot;
  const list = Array.isArray(detPag) ? detPag : detPag ? [detPag] : [];
  for (const row of list) {
    const label = paymentLabelFromCode(row?.tPag ?? row?.indPag);
    if (label) return label;
  }
  return '';
}

function extractChaveFromInfNFe(infNFe) {
  const id = infNFe?.['@_Id'] || infNFe?.Id || '';
  const digits = String(id).replace(/\D/g, '');
  return digits.length === 44 ? digits : digits.match(/\d{44}/)?.[0] || null;
}

/**
 * @param {string} xmlStr
 * @returns {null | {
 *   estabelecimento: string,
 *   endereco: string,
 *   data: string,
 *   cnpj: string,
 *   total: number | null,
 *   itens: Array<{ name: string, price: number, gtin?: string, quantity?: number }>,
 *   forma_pagamento: string,
 *   chave_nfe: string | null,
 * }}
 */
export function parseNfceXml(xmlStr) {
  try {
    const raw = String(xmlStr || '').trim();
    if (!raw || (!raw.includes('<') && !raw.startsWith('<?xml'))) return null;

    const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });
    const parsed = parser.parse(raw);
    const infNFe = parsed?.nfeProc?.NFe?.infNFe || parsed?.NFe?.infNFe;
    if (!infNFe) return null;

    const emit = infNFe?.emit || {};
    const ide = infNFe?.ide || {};
    const det = infNFe?.det;
    const detList = Array.isArray(det) ? det : det ? [det] : [];
    const total = infNFe?.total?.ICMSTot?.vNF ?? infNFe?.total?.ICMSTot?.vNF;
    const dhEmi = ide?.dhEmi || ide?.dEmi;

    let data = '';
    if (dhEmi) {
      const match = String(dhEmi).match(/(\d{4})-(\d{2})-(\d{2})/);
      if (match) data = `${match[1]}-${match[2]}-${match[3]}`;
    }

    const itens = detList
      .map((d) => {
        const prod = d?.prod || {};
        const desc = prod?.xProd || prod?.xProduto || 'Item';
        const price = parseMoney(prod?.vProd ?? prod?.vUnCom ?? 0) ?? 0;
        const qty = parseMoney(prod?.qCom ?? prod?.qTrib ?? 1) ?? 1;
        const cEAN = prod?.cEAN || prod?.cEANTrib || '';
        const gtinDigits = String(cEAN).replace(/\D/g, '');
        const gtin =
          gtinDigits.length >= 8 && gtinDigits.length <= 14 ? gtinDigits : null;
        const row = {
          name: String(desc).slice(0, 120),
          price,
          quantity: Math.max(1, qty),
        };
        if (gtin) row.gtin = gtin;
        return row;
      })
      .filter((i) => i.name && i.price >= 0);

    const nome = emit?.xFant || emit?.xNome || emit?.nome || '';
    const cnpj = emit?.CNPJ || emit?.cnpj || '';
    const enderEmit = emit?.enderEmit || {};
    const endereco = buildAddress({
      logradouro: enderEmit?.xLgr,
      numero: enderEmit?.nro,
      complemento: enderEmit?.xCpl,
      bairro: enderEmit?.xBairro,
      cidade: enderEmit?.xMun,
      estado: enderEmit?.UF,
      cep: enderEmit?.CEP,
    });

    return {
      estabelecimento: nome ? String(nome).trim() : '',
      endereco,
      data,
      cnpj: cnpj ? normalizeCnpj(String(cnpj).trim()) : '',
      total: total != null ? parseMoney(total) : null,
      itens,
      forma_pagamento: extractPayment(infNFe),
      chave_nfe: extractChaveFromInfNFe(infNFe),
    };
  } catch (_) {
    return null;
  }
}

export function looksLikeNfceXml(text) {
  const t = String(text || '');
  return (
    /<\s*nfeProc\b/i.test(t) ||
    /<\s*NFe\b/i.test(t) ||
    /<\s*infNFe\b/i.test(t) ||
    (t.includes('<') && /mod>\s*65\s*</i.test(t))
  );
}
