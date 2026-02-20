/**
 * POST /api/consultar-nfce
 *
 * Recebe a URL (ou conteúdo do QR code) da NFC-e, busca a página no servidor,
 * tenta extrair dados do XML (SEFAZ) e fallback para HTML.
 * Retorno: { estabelecimento, data, cnpj, total, itens, nfce_url }
 */

const SEFAZ_DOMAINS = [
  'nfce.fazenda.sp.gov.br',
  'nfce.fazenda.pr.gov.br',
  'nfce.fazenda.rs.gov.br',
  'nfce.fazenda.mg.gov.br',
  'nfce.fazenda.rj.gov.br',
  'sefaz.rs.gov.br',
  'sefaz.mt.gov.br',
  'nfe.fazenda.gov.br',
  'www.nfce.fazenda.sp.gov.br'
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
    return SEFAZ_DOMAINS.some((d) => host === d || host.endsWith('.' + d));
  } catch (_) {
    return false;
  }
}

function extractFromHtml(html) {
  const result = {
    estabelecimento: '',
    data: '',
    cnpj: '',
    total: null,
    itens: []
  };
  if (!html || typeof html !== 'string') return result;

  const totalLabel = html.match(/(?:valor\s+total|total\s+da\s+nota|total\s+geral)[\s:]*R\$\s*([\d.,]+)/i);
  if (totalLabel?.[1]) {
    const num = totalLabel[1].replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(num);
    if (!isNaN(parsed)) result.total = parsed;
  }
  if (result.total == null) {
    const allReais = html.match(/R\$\s*([\d]{1,3}(?:\.[\d]{3})*,[\d]{2})/g);
    if (allReais?.length > 0) {
      const last = allReais[allReais.length - 1];
      const num = last.replace(/R\$\s*/i, '').replace(/\./g, '').replace(',', '.');
      const parsed = parseFloat(num);
      if (!isNaN(parsed)) result.total = parsed;
    }
  }

  const dateMatch = html.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (dateMatch) {
    const [, d, m, y] = dateMatch;
    result.data = `${y}-${m}-${d}`;
  }

  const cnpjMatch = html.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
  if (cnpjMatch) result.cnpj = cnpjMatch[1];

  const nameMatch = html.match(/(?:razão\s+social|nome\s+fantasia|estabelecimento|emitente)[\s:]*([^<\n]+)/i)
    || html.match(/<h1[^>]*>([^<]+)</i)
    || html.match(/<title>([^<]+)</i);
  if (nameMatch) {
    const name = (nameMatch[1] || nameMatch[0]).replace(/\s+/g, ' ').trim();
    if (name.length > 2 && name.length < 200) result.estabelecimento = name;
  }

  const itemLines = html.match(/<tr[^>]*>[\s\S]*?<td[^>]*>([^<]+)<\/td>[\s\S]*?R\$\s*([\d.,]+)/gi);
  if (itemLines?.length > 0) {
    const seen = new Set();
    for (const line of itemLines.slice(0, 50)) {
      const desc = line.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const priceMatch = line.match(/R\$\s*([\d.,]+)/i);
      if (priceMatch) {
        const priceStr = priceMatch[1].replace(/\./g, '').replace(',', '.');
        const price = parseFloat(priceStr);
        const key = `${desc.slice(0, 50)}-${price}`;
        if (!seen.has(key) && !isNaN(price) && price > 0) {
          seen.add(key);
          result.itens.push({ name: desc.slice(0, 120) || 'Item', price });
        }
      }
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
    let data = '';
    if (dhEmi) {
      const match = String(dhEmi).match(/(\d{4})-(\d{2})-(\d{2})/);
      if (match) data = `${match[1]}-${match[2]}-${match[3]}`;
    }

    const itens = detList.map((d) => {
      const prod = d?.prod || {};
      const desc = prod?.xProd || prod?.xProduto || 'Item';
      const price = parseFloat(prod?.vProd || prod?.vUnCom || 0) || 0;
      return { name: String(desc).slice(0, 120), price };
    }).filter((i) => i.name && i.price >= 0);

    const nome = emit?.xFant || emit?.xNome || emit?.nome || '';
    const cnpj = emit?.CNPJ || emit?.cnpj || '';

    return {
      estabelecimento: nome ? { nome: String(nome).trim() } : '',
      data,
      cnpj: cnpj ? String(cnpj).trim() : '',
      total: total != null ? parseFloat(total) : null,
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
        data: '',
        cnpj: '',
        total: null,
        itens: [],
        nfce_url: urlToFetch
      });
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const text = await response.text();
    let out = { estabelecimento: '', data: '', cnpj: '', total: null, itens: [], nfce_url: urlToFetch };

    if (contentType.includes('xml') || text.trimStart().startsWith('<?xml') || text.trimStart().startsWith('<nfe')) {
      const fromXml = parseNfceXml(text);
      if (fromXml) {
        out = { ...fromXml, nfce_url: urlToFetch };
      }
    }
    if (out.estabelecimento === '' && out.itens.length === 0) {
      const fromHtml = extractFromHtml(text);
      out.estabelecimento = fromHtml.estabelecimento || '';
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
