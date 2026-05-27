/**
 * POST /api/ocr/fetch-nfce
 *
 * Recebe a URL (ou conteúdo do QR code) da NFC-e, busca a página no servidor
 * e tenta extrair: estabelecimento, valor total, data, itens.
 * A URL do QR code da nota fiscal brasileira aponta para portais SEFAZ (varia por estado).
 */

function normalizeNfceUrl(qrContent) {
  const trimmed = (qrContent || '').trim();
  if (!trimmed) return null;
  // Já é uma URL
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  // Alguns QRs trazem só o parâmetro (ex: p=3523...)
  if (/^[pP]=/.test(trimmed)) {
    const base = 'https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx';
    return `${base}?${trimmed}`;
  }
  // Chave de 44 dígitos: alguns estados usam em consulta
  if (/^\d{44}$/.test(trimmed.replace(/\D/g, ''))) {
    const chave = trimmed.replace(/\D/g, '');
    return `https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx?p=${chave}`;
  }
  return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
}

function extractFromHtml(html) {
  const result = {
    merchant_name: '',
    merchant_cnpj: '',
    total_amount: '',
    date: '',
    items: []
  };

  if (!html || typeof html !== 'string') return result;

  // Valor total: R$ 1.234,56 ou "Valor Total" próximo a um valor
  const totalLabel = html.match(/(?:valor\s+total|total\s+da\s+nota|total\s+geral)[\s:]*R\$\s*([\d.,]+)/i);
  if (totalLabel && totalLabel[1]) {
    const num = totalLabel[1].replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(num);
    if (!isNaN(parsed)) result.total_amount = parsed.toFixed(2);
  }
  if (!result.total_amount) {
    const allReais = html.match(/R\$\s*([\d]{1,3}(?:\.[\d]{3})*,[\d]{2})/g);
    if (allReais && allReais.length > 0) {
      const last = allReais[allReais.length - 1];
      const num = last.replace(/R\$\s*/i, '').replace(/\./g, '').replace(',', '.');
      const parsed = parseFloat(num);
      if (!isNaN(parsed)) result.total_amount = parsed.toFixed(2);
    }
  }

  // Data: DD/MM/YYYY ou DD/MM/YYYY HH:mm
  const dateMatch = html.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (dateMatch) {
    const [, d, m, y] = dateMatch;
    result.date = `${y}-${m}-${d}`;
  }

  // CNPJ: 00.000.000/0000-00
  const cnpjMatch = html.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
  if (cnpjMatch) result.merchant_cnpj = cnpjMatch[1];

  // Nome do estabelecimento: comum em título, h1, ou "Razão Social", "Nome"
  const nameMatch = html.match(/(?:razão\s+social|nome\s+fantasia|estabelecimento|emitente)[\s:]*([^<\n]+)/i)
    || html.match(/<h1[^>]*>([^<]+)</i)
    || html.match(/<title>([^<]+)</i);
  if (nameMatch) {
    const name = (nameMatch[1] || nameMatch[0]).replace(/\s+/g, ' ').trim();
    if (name.length > 2 && name.length < 200) result.merchant_name = name;
  }

  // Itens: linhas com descrição e valor (padrão simples)
  const itemLines = html.match(/<tr[^>]*>[\s\S]*?<td[^>]*>([^<]+)<\/td>[\s\S]*?R\$\s*([\d.,]+)/gi);
  if (itemLines && itemLines.length > 0) {
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
          result.items.push({ name: desc.slice(0, 120) || 'Item', price });
        }
      }
    }
  }

  return result;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { url: urlParam, qrContent } = req.body || {};
    const urlToFetch = normalizeNfceUrl(urlParam || qrContent);
    if (!urlToFetch) {
      return res.status(400).json({
        success: false,
        error: 'URL ou conteúdo do QR code é obrigatório',
        data: null
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
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
        success: true,
        data: {
          merchant_name: '',
          merchant_cnpj: '',
          total_amount: '',
          date: '',
          items: [],
          receipt_image_url: '',
          nfce_url: urlToFetch
        },
        message: 'Não foi possível acessar a página da nota. Preencha os dados manualmente.'
      });
    }

    const html = await response.text();
    const data = extractFromHtml(html);
    data.receipt_image_url = '';
    data.nfce_url = urlToFetch;

    return res.status(200).json({
      success: true,
      data,
      message: data.merchant_name || data.total_amount ? 'Dados extraídos da NFC-e.' : 'Confira e complete os dados abaixo.'
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(408).json({
        success: false,
        error: 'A consulta à NFC-e demorou demais. Tente de novo.',
        data: null
      });
    }
    console.error('fetch-nfce error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Erro ao buscar dados da NFC-e',
      data: null
    });
  }
}
