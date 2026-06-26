/**
 * POST /api/consultar-nfce
 *
 * Recebe a URL (ou conteúdo do QR code) da NFC-e, busca a página no servidor,
 * tenta extrair dados do XML (SEFAZ) e fallback para HTML.
 * Retorno: { estabelecimento, endereco, data, cnpj, total, itens, nfce_url }
 */

import { extractChave44, isValidChaveNfceDv44 } from '../../lib/nfceUrl';
import { parseNfceXml } from '../../lib/parseNfceXml';

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
  'nfce.fazenda.gov.br',
  'consultapublica.fazenda.sp.gov.br',
  'fazenda.sp.gov.br'
];

function normalizeNfceUrl(qrContent) {
  let trimmed = String(qrContent || '').trim();
  if (!trimmed) return null;
  if (trimmed.includes('%')) {
    try {
      trimmed = decodeURIComponent(trimmed);
    } catch (_) {
      /* keep trimmed */
    }
  }

  const pParam = extractPParam(trimmed);
  if (pParam) {
    return `https://www.nfce.fazenda.sp.gov.br/qrcode?p=${encodeURIComponent(pParam)}`;
  }

  const chave44 = extractChave44(trimmed);
  if (chave44 && !/^https?:\/\//i.test(trimmed)) {
    return `https://www.nfce.fazenda.sp.gov.br/qrcode?p=${encodeURIComponent(chave44)}`;
  }
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[pP]=/.test(trimmed)) {
    const rawP = trimmed.replace(/^[pP]=/, '');
    return `https://www.nfce.fazenda.sp.gov.br/qrcode?p=${encodeURIComponent(rawP)}`;
  }
  if (/^\d{44}$/.test(trimmed.replace(/\D/g, ''))) {
    const chave = trimmed.replace(/\D/g, '');
    return `https://www.nfce.fazenda.sp.gov.br/qrcode?p=${encodeURIComponent(chave)}`;
  }
  return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
}

/** Extrai parâmetro p completo (chave|versão|ambiente|hash) da URL ou texto colado. */
function extractPParam(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;

  try {
    const u = new URL(text);
    const p = u.searchParams.get('p');
    if (p && p.length >= 44) return p;
  } catch (_) {
    /* não é URL absoluta */
  }

  const qMatch = text.match(/[?&]p=([^#&\s]+)/i);
  if (qMatch?.[1]) {
    try {
      return decodeURIComponent(qMatch[1]);
    } catch (_) {
      return qMatch[1];
    }
  }

  const pipeMatch = text.match(/(\d{44}\|[^\s#]+)/);
  if (pipeMatch?.[1]) return pipeMatch[1];

  return null;
}

function buildSpFetchUrls(rawInput, normalizedUrl) {
  const pParam = extractPParam(rawInput) || extractPParam(normalizedUrl);
  const chave44 = extractChave44(rawInput) || extractChave44(normalizedUrl);
  const urls = [];

  if (normalizedUrl) urls.push(normalizedUrl);
  if (rawInput && /^https?:\/\//i.test(String(rawInput).trim())) {
    urls.push(String(rawInput).trim());
  }

  if (pParam) {
    urls.push(`https://www.nfce.fazenda.sp.gov.br/qrcode?p=${encodeURIComponent(pParam)}`);
    urls.push(`https://www.nfce.fazenda.sp.gov.br/qrcode?p=${pParam}`);
    urls.push(
      `https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx?p=${encodeURIComponent(pParam)}`
    );
  } else if (chave44) {
    urls.push(`https://www.nfce.fazenda.sp.gov.br/qrcode?p=${encodeURIComponent(chave44)}`);
    urls.push(
      `https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx?p=${chave44}`
    );
  }

  return [...new Set(urls.filter(Boolean))];
}

function isGenericConsultaPage(html) {
  if (!html || typeof html !== 'string') return true;
  if (html.includes('id="tabResult"') && html.includes('class="valor"')) return false;
  if (html.includes('txtTopo') && html.includes('txtTit')) return false;
  return /ConsultaPublica\.aspx/i.test(html) || /id="Conteudo_txtChaveAcesso"/i.test(html);
}

function isPortalEstablishment(name) {
  if (!name) return true;
  return /secretaria\s+da\s+fazenda|governo\s+do\s+estado|consulta\s+nfc-?e|portal\s+sefaz/i.test(name);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchNfcePage(url) {
  const maxAttempts = 3;
  const timeoutMs = 22000;
  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) await sleep(500 + attempt * 450);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9'
        },
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (response.ok) return response;
      if (response.status >= 500 && attempt < maxAttempts - 1) continue;
      return response;
    } catch (e) {
      clearTimeout(timeout);
      lastErr = e;
      if (attempt < maxAttempts - 1) continue;
      throw e;
    }
  }
  throw lastErr;
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
  const pagarMatch = text.match(/valor\s+a\s+pagar\s*R?\$?\s*:?\s*([\d]{1,3}(?:\.[\d]{3})*,[\d]{2}|[\d]+,[\d]{2})/i);
  if (pagarMatch?.[1]) return parseMoney(pagarMatch[1]);

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

function extractTotalFromHtml(html) {
  if (!html) return null;
  const pagarBlock = html.match(
    /Valor a pagar R\$:\s*<\/label>\s*<span[^>]*class=["'][^"']*totalNumb[^"']*["'][^>]*>([\d.,]+)/i
  );
  if (pagarBlock?.[1]) return parseMoney(pagarBlock[1]);

  const txtMax = html.match(/<span[^>]*class=["'][^"']*totalNumb[^"']*txtMax[^"']*["'][^>]*>([\d.,]+)/i);
  if (txtMax?.[1]) return parseMoney(txtMax[1]);

  return null;
}

function extractPaymentFromHtml(html) {
  if (!html) return '';
  const m = html.match(/<label[^>]*class=["']tx["'][^>]*>\s*([^<]+?)\s*<\/label>/i);
  if (!m?.[1]) return extractPaymentFromText(normalizeText(stripHtml(html)));
  const raw = normalizeText(m[1]);
  if (/dinheiro/i.test(raw)) return 'Dinheiro';
  if (/pix/i.test(raw)) return 'PIX';
  if (/d[eé]bito/i.test(raw)) return 'Débito';
  if (/cr[eé]dito/i.test(raw)) return 'Cartão de Crédito';
  return raw.slice(0, 40);
}

function extractPaymentFromText(text) {
  if (!text) return '';
  const m = text.match(/forma\s+de\s+pagamento\s*[:\s]*([^\n]+)/i);
  if (!m?.[1]) return '';
  const raw = normalizeText(m[1]);
  if (/dinheiro/i.test(raw)) return 'Dinheiro';
  if (/pix/i.test(raw)) return 'PIX';
  if (/d[eé]bito/i.test(raw)) return 'Débito';
  if (/cr[eé]dito/i.test(raw)) return 'Cartão de Crédito';
  return raw.slice(0, 40);
}

/** Portal SP novo: PRODUTO (Código: N) … Vl. Total X,XX */
function extractSpPortalItems(plainText) {
  if (!plainText) return [];
  const items = [];
  const seen = new Set();
  const re =
    /([A-ZÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ0-9][A-ZÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ0-9\s.\-/]{3,90}?)\s*\(C[oó]digo:\s*\d+\)[\s\S]*?Vl\.\s*Total\s*:?\s*([\d]{1,3}(?:\.[\d]{3})*,[\d]{2}|[\d]+,[\d]{2})/gi;
  let match;
  while ((match = re.exec(plainText)) !== null) {
    const name = normalizeText(match[1]);
    const price = parseMoney(match[2]);
    if (!name || name.length < 3 || !Number.isFinite(price) || price <= 0) continue;
    if (/^(cnpj|cpf|documento|valor|forma|qtd)/i.test(name)) continue;
    const key = `${name.slice(0, 60)}-${price}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ name: name.slice(0, 120), price });
    if (items.length >= 80) break;
  }
  return items;
}

function extractItemsFromDivBlocks(html) {
  const items = [];
  const seen = new Set();
  const blockRe = /<div[^>]*class=["'][^"']*(?:item|produto|det)[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;
  let match;
  while ((match = blockRe.exec(html)) !== null) {
    const block = normalizeText(stripHtml(match[1]));
    const priceMatch = block.match(/Vl\.\s*Total\s*:?\s*([\d.,]+)/i) || block.match(/R\$\s*([\d.,]+)/i);
    if (!priceMatch) continue;
    const price = parseMoney(priceMatch[1]);
    const name = block
      .replace(/\(C[oó]digo:[^)]+\)/gi, '')
      .replace(/Qtde\.?:[^V]+/gi, '')
      .replace(/Vl\.\s*Unit[^V]*/gi, '')
      .replace(/Vl\.\s*Total.*/gi, '')
      .trim();
    if (!name || name.length < 3 || !Number.isFinite(price) || price <= 0) continue;
    const key = `${name.slice(0, 60)}-${price}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ name: name.slice(0, 120), price });
    if (items.length >= 80) break;
  }
  return items;
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
    if (!row.includes('txtTit')) continue;

    const nameMatch =
      row.match(/<td[^>]*>[\s\S]*?<span\s+class=["']txtTit["'][^>]*>([\s\S]*?)<\/span>/i) ||
      row.match(/class=["']txtTit["'][^>]*>([\s\S]*?)<\/[^>]+>/i);
    const priceMatch =
      row.match(/<span\s+class=["']valor["'][^>]*>([\s\S]*?)<\/span>/i) ||
      row.match(/class=["']txtVlr["'][^>]*>([\s\S]*?)<\/[^>]+>/i) ||
      row.match(/R\$\s*([\d.,]+)/i);

    if (!nameMatch || !priceMatch) continue;
    const desc = normalizeText(stripHtml(nameMatch[1] || nameMatch[0]));
    const price = parseMoney(priceMatch[1] || priceMatch[0]);
    if (!desc || desc.length < 2 || /^vl\.?\s*total$/i.test(desc)) continue;
    if (!Number.isFinite(price) || price <= 0) continue;
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
  result.total = extractTotalFromHtml(html) ?? extractTotalFromText(plainText);

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

  const topoName = topoLines.find((line) => line && !isPortalEstablishment(line) && line.length > 3);
  if (topoName) result.estabelecimento = topoName;

  const candidateLines = [
    ...emitenteLines,
    h1Text,
    h2Text,
  ].map(normalizeText).filter(Boolean);

  if (!result.estabelecimento) {
    const nameLine = candidateLines.find((line) => !isMetaLine(line) && !isPortalEstablishment(line));
    if (nameLine) result.estabelecimento = nameLine;
  }

  const addressLine = candidateLines.find(looksLikeAddress)
    || extractAddressFromText(plainText);
  if (addressLine) result.endereco = normalizeText(addressLine);

  const itemRows = extractItemRows(html);
  if (itemRows.length > 0) {
    result.itens = itemRows.slice(0, 60);
  }

  if (result.itens.length === 0) {
    const spItems = extractSpPortalItems(plainText);
    if (spItems.length > 0) result.itens = spItems;
  }

  if (result.itens.length === 0) {
    const divItems = extractItemsFromDivBlocks(html);
    if (divItems.length > 0) result.itens = divItems;
  }

  result.forma_pagamento = extractPaymentFromHtml(html) || extractPaymentFromText(plainText);

  if (!result.estabelecimento) {
    const lines = plainText.split(/\s{2,}|\n/).map(normalizeText).filter((l) => l.length > 4);
    const cnpjIdx = lines.findIndex((l) => /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/.test(l));
    if (cnpjIdx > 0) {
      const candidate = lines[cnpjIdx - 1];
      if (candidate && !isMetaLine(candidate) && candidate.length < 120) {
        result.estabelecimento = candidate;
      }
    }
  }

  if (!result.estabelecimento) {
    const nameMatch = plainText.match(/(?:raz[aã]o\s+social|nome\s+fantasia|emitente)[\s:]*([^\n]+)/i);
    if (nameMatch?.[1]) {
      result.estabelecimento = normalizeText(nameMatch[1]);
    }
  }

  return result;
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

    const chaveOnly = extractChave44(String(urlParam || '').trim());
    let dvAviso = null;
    if (chaveOnly && !isValidChaveNfceDv44(chaveOnly)) {
      dvAviso = 'A chave de 44 dígitos parece incorreta (dígito verificador). Confira se copiou tudo.';
    }

    const urlsToTry = buildSpFetchUrls(urlParam, urlToFetch);
    let text = '';
    let resolvedUrl = urlToFetch;
    let lastStatus = 0;

    for (const tryUrl of urlsToTry) {
      const response = await fetchNfcePage(tryUrl);
      lastStatus = response.status;
      if (!response.ok) continue;
      const body = await response.text();
      if (!isGenericConsultaPage(body)) {
        text = body;
        resolvedUrl = response.url || tryUrl;
        break;
      }
      if (!text) {
        text = body;
        resolvedUrl = response.url || tryUrl;
      }
    }

    if (!text) {
      return res.status(200).json({
        estabelecimento: '',
        endereco: '',
        data: '',
        cnpj: '',
        total: null,
        itens: [],
        nfce_url: urlToFetch,
        aviso: [dvAviso, `Portal SEFAZ retornou HTTP ${lastStatus || 'erro'}. Tente novamente.`].filter(Boolean).join(' '),
      });
    }

    if (isGenericConsultaPage(text)) {
      return res.status(200).json({
        estabelecimento: '',
        endereco: '',
        data: '',
        cnpj: '',
        total: null,
        itens: [],
        nfce_url: urlToFetch,
        aviso: [
          dvAviso,
          'Link incompleto: copie o endereço completo do navegador logo após ler o QR (deve conter ?p= com a chave da nota), ou escaneie o QR dentro do app.',
        ]
          .filter(Boolean)
          .join(' '),
      });
    }

    const contentType = (text.includes('<?xml') || text.trimStart().startsWith('<nfe')) ? 'application/xml' : 'text/html';
    let out = {
      estabelecimento: '',
      endereco: '',
      data: '',
      cnpj: '',
      total: null,
      itens: [],
      forma_pagamento: '',
      nfce_url: resolvedUrl,
    };

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
      out.forma_pagamento = fromHtml.forma_pagamento || '';
    }

    if (dvAviso) {
      out.aviso = out.aviso ? `${dvAviso} ${out.aviso}` : dvAviso;
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
