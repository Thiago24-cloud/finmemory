/**
 * POST /api/consultar-nfce
 *
 * Recebe a URL (ou conteúdo do QR code) da NFC-e, busca a página no servidor,
 * tenta extrair dados do XML (SEFAZ) e fallback para HTML.
 * Retorno: { estabelecimento, endereco, data, cnpj, total, itens, nfce_url }
 */

const SEFAZ_DOMAINS = [
  'nfce.fazenda.sp.gov.br',
  'nfce.fazenda.rj.gov.br',
  'nfce.fazenda.mg.gov.br',
  'nfce.fazenda.rs.gov.br',
  'nfce.fazenda.pr.gov.br',
  'nfce.sefaz.ba.gov.br',
  'nfce.sefaz.ce.gov.br',
  'nfce.sefaz.pe.gov.br',
  'nfce.sefaz.am.gov.br',
  'nfce.sefaz.mt.gov.br',
  'nfce.sefaz.ms.gov.br',
  'nfce.sefaz.pa.gov.br',
  'nfce.sefaz.pb.gov.br',
  'nfce.sefaz.pi.gov.br',
  'nfce.sefaz.ro.gov.br',
  'nfce.sefaz.rr.gov.br',
  'nfce.sefaz.rs.gov.br',
  'nfce.sefaz.se.gov.br',
  'nfce.sefaz.to.gov.br',
  'sefaz.sp.gov.br',
  'sefaz.rj.gov.br',
  'sefaz.mg.gov.br',
  'sefaz.rs.gov.br',
  'sefaz.pr.gov.br',
  'sefaz.ba.gov.br',
  'sefaz.ce.gov.br',
  'sefaz.pe.gov.br',
  'sefaz.am.gov.br',
  'sefaz.mt.gov.br',
  'sefaz.ms.gov.br',
  'sefaz.pa.gov.br',
  'sefaz.pb.gov.br',
  'sefaz.pi.gov.br',
  'sefaz.ro.gov.br',
  'sefaz.rr.gov.br',
  'sefaz.se.gov.br',
  'sefaz.to.gov.br',
  'nfe.fazenda.gov.br',
  'nfce.fazenda.gov.br'
];

function normalizeNfceUrl(qrContent) {
  const trimmed = (qrContent || '').trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[pP]=/.test(trimmed)) {
    return `https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx?${trimmed}`;
  }
  if (/^\d{44}$/.test(trimmed.replace(/\D/g, ''))) {
    const chave = trimmed.replace(/\D/g, '');
    return `https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx?p=${chave}`;
  }
  return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
}

function isSefazUrl(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (SEFAZ_DOMAINS.some((d) => host === d || host.endsWith('.' + d))) {
      return true;
    }
    if (!host.endsWith('.gov.br')) return false;
    return (
      /(^|\.)((nfce|nfe)\.)?(sefaz|fazenda)\.[a-z]{2}\.gov\.br$/i.test(host) ||
      /(^|\.)nfe\.fazenda\.gov\.br$/i.test(host) ||
      /(^|\.)nfce\.fazenda\.gov\.br$/i.test(host)
    );
  } catch (_) {
    return false;
  }
}

function normalizeText(value) {
  if (!value) return '';
  return decodeHtmlEntities(String(value)).replace(/\s+/g, ' ').trim();
}

function stripHtml(html) {
  if (!html) return '';
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

function decodeHtmlEntities(text) {
  if (!text) return '';
  return String(text)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
}

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

function extractTotalFromText(text) {
  if (!text) return null;
  const labelMatch = text.match(/(?:valor\s+total|total\s+da\s+nota|total\s+geral)\s*[:\-]?\s*R?\$?\s*([\d.,]+)/i);
  if (labelMatch?.[1]) {
    return parseMoney(labelMatch[1]);
  }
  const allReais = text.match(/R?\$?\s*([\d]{1,3}(?:\.[\d]{3})*,[\d]{2})/g);
  if (allReais?.length > 0) {
    const last = allReais[allReais.length - 1];
    return parseMoney(last);
  }
  return null;
}

function extractClassLines(html, className) {
  const lines = [];
  if (!html) return lines;
  const regex = new RegExp(`<[^>]+class=["'][^"']*${className}[^"']*["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`, 'gi');
  let match;
  while ((match = regex.exec(html)) !== null) {
    const text = normalizeText(stripHtml(match[1]));
    if (text) lines.push(text);
  }
  return lines;
}

function extractTagText(html, tagName) {
  if (!html) return '';
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = html.match(regex);
  return match?.[1] ? normalizeText(stripHtml(match[1])) : '';
}

function isMetaLine(line) {
  if (!line) return true;
  return /(cnpj|cpf|inscri|ie|im|emitente|endereco|endereço|cep|chave|serie|s[eé]rie|data|emiss[aã]o|total|valor|sefaz|nfc-e)/i.test(line);
}

function looksLikeAddress(line) {
  if (!line) return false;
  const upper = line.toUpperCase();
  return (
    /\b(RUA|AV\.?|AVENIDA|RODOVIA|ROD\.?|TRAVESSA|ALAMEDA|ESTRADA|PRA[ÇC]A|PC|PCA|Nº|NRO|NUM|KM)\b/.test(upper) ||
    /\b\d{5}-?\d{3}\b/.test(upper)
  );
}

function extractAddressFromText(text) {
  if (!text) return '';
  const match = text.match(/endere[cç]o\s*[:\-]?\s*(.+?)(?:\s+cnpj|\s+cpf|\s+ie|\s+chave|\s+total|\s+valor|\s+data|\s+emiss[aã]o|$)/i);
  return match?.[1] ? normalizeText(match[1]) : '';
}

function extractItemRows(html) {
  if (!html) return [];
  const items = [];
  const seen = new Set();
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let match;
  while ((match = rowRegex.exec(html)) !== null) {
    const row = match[1];
    const descMatch =
      row.match(/class=["']txtTit["'][^>]*>([\s\S]*?)<\/[^>]+>/i) ||
      row.match(/<td[^>]*>([^<]{3,})<\/td>/i);
    const priceMatch =
      row.match(/class=["']txtVlr["'][^>]*>([\s\S]*?)<\/[^>]+>/i) ||
      row.match(/R\$\s*([\d.,]+)/i);
    if (!descMatch || !priceMatch) continue;
    const desc = normalizeText(stripHtml(descMatch[1] || descMatch[0]));
    const price = parseMoney(priceMatch[1] || priceMatch[0]);
    if (!desc || !Number.isFinite(price) || price < 0) continue;
    const key = `${desc.slice(0, 80)}-${price}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ name: desc.slice(0, 120), price });
    if (items.length >= 80) break;
  }
  return items;
}

function buildAddress({ logradouro, numero, complemento, bairro, cidade, estado, cep }) {
  const street = normalizeText([logradouro, numero].filter(Boolean).join(' '));
  const cityState = normalizeText([cidade, estado].filter(Boolean).join(' - '));
  const formattedCep = formatCep(cep);
  const parts = [street, complemento, bairro, cityState, formattedCep].map(normalizeText).filter(Boolean);
  return parts.join(', ');
}

function formatCep(value) {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '');
  if (digits.length !== 8) return String(value).trim();
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function extractFromHtml(html) {
  const result = {
    estabelecimento: '',
    endereco: '',
    data: '',
    cnpj: '',
    total: null,
    itens: []
  };
  if (!html || typeof html !== 'string') return result;

  const plainText = normalizeText(stripHtml(html));
  result.total = extractTotalFromText(plainText);

  const dateMatch = plainText.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (dateMatch) {
    const [, d, m, y] = dateMatch;
    result.data = `${y}-${m}-${d}`;
  }

  const cnpjMatch = plainText.match(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/);
  if (cnpjMatch) result.cnpj = normalizeCnpj(cnpjMatch[0]);

  const topoLines = extractClassLines(html, 'txtTopo');
  const emitenteLines = extractClassLines(html, 'emitente');
  const titleText = extractTagText(html, 'title');
  const h1Text = extractTagText(html, 'h1');
  const h2Text = extractTagText(html, 'h2');

  const candidateLines = [
    ...topoLines,
    ...emitenteLines,
    h1Text,
    h2Text,
    titleText
  ].map(normalizeText).filter(Boolean);

  const nameLine = candidateLines.find((line) => !isMetaLine(line));
  if (nameLine) result.estabelecimento = nameLine;

  const addressLine = candidateLines.find(looksLikeAddress)
    || extractAddressFromText(plainText);
  if (addressLine) result.endereco = normalizeText(addressLine);

  const itemRows = extractItemRows(html);
  if (itemRows.length > 0) {
    result.itens = itemRows.slice(0, 60);
  }

  if (!result.estabelecimento) {
    const nameMatch = plainText.match(/(?:raz[aã]o\s+social|nome\s+fantasia|emitente)[\s:]*([^\n]+)/i);
    if (nameMatch?.[1]) {
      result.estabelecimento = normalizeText(nameMatch[1]);
    }
  }

  return result;
}

function parseNfceXml(xmlStr) {
  try {
    const { XMLParser } = require('fast-xml-parser');
    const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });
    const parsed = parser.parse(xmlStr);
    const nfe = parsed?.nfeProc?.NFe?.infNFe
      || parsed?.NFe?.infNFe
      || parsed?.retConsSitNFe?.protNFe?.infProt;
    const infNFe = parsed?.nfeProc?.NFe?.infNFe || parsed?.NFe?.infNFe;
    if (!infNFe) return null;

    const emit = infNFe?.emit || {};
    const ide = infNFe?.ide || {};
    const det = infNFe?.det;
    const detList = Array.isArray(det) ? det : det ? [det] : [];
    const total = infNFe?.total?.ICMSTot?.vNF ?? infNFe?.total?.['ICMSTot']?.vNF;
    const dhEmi = ide?.dhEmi || ide?.dEmi;
    const enderEmit = emit?.enderEmit || {};
    let data = '';
    if (dhEmi) {
      const match = String(dhEmi).match(/(\d{4})-(\d{2})-(\d{2})/);
      if (match) data = `${match[1]}-${match[2]}-${match[3]}`;
    }

    const itens = detList.map((d) => {
      const prod = d?.prod || {};
      const desc = prod?.xProd || prod?.xProduto || 'Item';
      const price = parseMoney(prod?.vProd ?? prod?.vUnCom ?? 0) ?? 0;
      return { name: String(desc).slice(0, 120), price };
    }).filter((i) => i.name && i.price >= 0);

    const nome = emit?.xFant || emit?.xNome || emit?.nome || '';
    const cnpj = emit?.CNPJ || emit?.cnpj || '';
    const endereco = buildAddress({
      logradouro: enderEmit?.xLgr,
      numero: enderEmit?.nro,
      complemento: enderEmit?.xCpl,
      bairro: enderEmit?.xBairro,
      cidade: enderEmit?.xMun,
      estado: enderEmit?.UF,
      cep: enderEmit?.CEP
    });

    return {
      estabelecimento: nome ? String(nome).trim() : '',
      endereco,
      data,
      cnpj: cnpj ? normalizeCnpj(String(cnpj).trim()) : '',
      total: total != null ? parseMoney(total) : null,
      itens
    };
  } catch (_) {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { url: urlParam } = req.body || {};
    const urlToFetch = normalizeNfceUrl(urlParam);
    if (!urlToFetch) {
      return res.status(400).json({ error: 'URL ou conteúdo do QR code é obrigatório' });
    }
    if (!isSefazUrl(urlToFetch)) {
      return res.status(400).json({ error: 'URL não é de portal SEFAZ válido para NFC-e' });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(urlToFetch, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return res.status(200).json({
        estabelecimento: '',
        endereco: '',
        data: '',
        cnpj: '',
        total: null,
        itens: [],
        nfce_url: urlToFetch
      });
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const text = await response.text();
    let out = { estabelecimento: '', endereco: '', data: '', cnpj: '', total: null, itens: [], nfce_url: urlToFetch };

    if (contentType.includes('xml') || text.trimStart().startsWith('<?xml') || text.trimStart().startsWith('<nfe')) {
      const fromXml = parseNfceXml(text);
      if (fromXml) {
        out = { ...fromXml, nfce_url: urlToFetch };
      }
    }
    if (out.estabelecimento === '' && out.itens.length === 0) {
      const fromHtml = extractFromHtml(text);
      out.estabelecimento = fromHtml.estabelecimento || '';
      out.endereco = fromHtml.endereco || '';
      out.data = out.data || fromHtml.data || '';
      out.cnpj = out.cnpj || fromHtml.cnpj || '';
      out.total = out.total != null ? out.total : fromHtml.total;
      out.itens = out.itens?.length ? out.itens : fromHtml.itens || [];
    }

    return res.status(200).json(out);
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(408).json({ error: 'A consulta à NFC-e demorou demais. Tente de novo.' });
    }
    console.error('consultar-nfce error:', err);
    return res.status(500).json({
      error: err.message || 'Erro ao buscar dados da NFC-e'
    });
  }
}
