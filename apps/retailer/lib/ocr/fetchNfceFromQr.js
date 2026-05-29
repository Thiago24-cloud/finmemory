export function normalizeNfceUrl(qrContent) {
  const trimmed = (qrContent || '').trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[pP]=/.test(trimmed)) {
    return `https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx?${trimmed}`;
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 44) {
    return `https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx?p=${digits}`;
  }
  return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
}

export function extractChaveNfeFromText(text) {
  const digits = String(text || '').replace(/\D/g, '');
  const match = digits.match(/\d{44}/);
  return match ? match[0] : null;
}

function extractFromHtml(html) {
  const result = {
    merchant_name: '',
    merchant_cnpj: '',
    total_amount: null,
    date: null,
    items: [],
  };

  if (!html || typeof html !== 'string') return result;

  const totalLabel = html.match(/(?:valor\s+total|total\s+da\s+nota)[\s:]*R\$\s*([\d.,]+)/i);
  if (totalLabel?.[1]) {
    const parsed = parseFloat(totalLabel[1].replace(/\./g, '').replace(',', '.'));
    if (Number.isFinite(parsed)) result.total_amount = parsed;
  }

  const dateMatch = html.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (dateMatch) {
    const [, d, m, y] = dateMatch;
    result.date = `${y}-${m}-${d}`;
  }

  const cnpjMatch = html.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
  if (cnpjMatch) result.merchant_cnpj = cnpjMatch[1];

  const nameMatch =
    html.match(/(?:razão\s+social|nome\s+fantasia)[\s:]*([^<\n]+)/i) ||
    html.match(/<h1[^>]*>([^<]+)</i);
  if (nameMatch?.[1]) {
    const name = nameMatch[1].replace(/\s+/g, ' ').trim();
    if (name.length > 2 && name.length < 200) result.merchant_name = name;
  }

  const itemLines = html.match(/<tr[^>]*>[\s\S]*?<td[^>]*>([^<]+)<\/td>[\s\S]*?R\$\s*([\d.,]+)/gi);
  if (itemLines?.length) {
    const seen = new Set();
    for (const line of itemLines.slice(0, 80)) {
      const desc = line.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const priceMatch = line.match(/R\$\s*([\d.,]+)/i);
      if (!priceMatch) continue;
      const price = parseFloat(priceMatch[1].replace(/\./g, '').replace(',', '.'));
      const key = `${desc.slice(0, 40)}-${price}`;
      if (seen.has(key) || !Number.isFinite(price) || price <= 0) continue;
      seen.add(key);
      result.items.push({ name: desc.slice(0, 200) || 'Item', price, quantity: 1 });
    }
  }

  return result;
}

/**
 * @param {string} qrContent
 */
export async function fetchNfceFromQr(qrContent) {
  const urlToFetch = normalizeNfceUrl(qrContent);
  if (!urlToFetch) {
    return { ok: false, error: 'URL ou QR inválido.' };
  }

  const chave_nfe = extractChaveNfeFromText(qrContent) || extractChaveNfeFromText(urlToFetch);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const response = await fetch(urlToFetch, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return {
        ok: true,
        partial: true,
        data: {
          merchant_name: '',
          merchant_cnpj: '',
          total_amount: null,
          date: null,
          items: [],
          nfce_url: urlToFetch,
          chave_nfe,
        },
        message: 'Não foi possível ler a página da NFC-e. Complete os dados manualmente.',
      };
    }

    const html = await response.text();
    const data = extractFromHtml(html);
    return {
      ok: true,
      data: {
        ...data,
        nfce_url: urlToFetch,
        chave_nfe,
        receipt_image_url: null,
      },
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { ok: false, error: 'Consulta à NFC-e demorou demais.' };
    }
    return { ok: false, error: err.message || 'Erro ao buscar NFC-e.' };
  }
}
