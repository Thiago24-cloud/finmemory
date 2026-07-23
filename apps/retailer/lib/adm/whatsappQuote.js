/**
 * Extrai endereço, telefone e itens de lista a partir de texto colado do WhatsApp.
 */

const ADDRESS_HINT =
  /\b(rua|r\.|av\.|avenida|alameda|travessa|estrada|rodovia|bairro|cep|número|numero|n[ºo°]|são paulo|sao paulo|sp\b|endere[cç]o|apto|apartamento|bloco)\b/i;

const PHONE_RE = /(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?(?:9?\d{4})[-\s]?\d{4}/g;

export function normalizeWhatsAppDigitsLoose(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55') && digits.length >= 12) return digits.slice(0, 13);
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits.slice(0, 13);
}

function cleanLine(line) {
  return String(line || '')
    .replace(/^[\s>*\-•\d.)\]]+\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {string} raw
 * @returns {{ address: string|null, phone: string|null, phone_digits: string|null, items: string[], raw_lines: string[] }}
 */
export function parseWhatsappQuotePaste(raw) {
  const text = String(raw || '').replace(/\r/g, '').trim();
  const lines = text
    .split('\n')
    .map(cleanLine)
    .filter((l) => l.length > 0);

  let phone = null;
  const phoneMatch = text.match(PHONE_RE);
  if (phoneMatch?.[0]) {
    phone = phoneMatch[0].trim();
  }

  const addressLines = [];
  const itemLines = [];

  for (const line of lines) {
    if (PHONE_RE.test(line) && line.replace(PHONE_RE, '').trim().length < 3) {
      PHONE_RE.lastIndex = 0;
      continue;
    }
    PHONE_RE.lastIndex = 0;

    const looksAddress =
      ADDRESS_HINT.test(line) ||
      /\d{5}-?\d{3}/.test(line) ||
      (/\d/.test(line) && /,\s*[A-Za-zÀ-ú]/.test(line) && line.length > 18);

    const looksListItem =
      /^(?:\d+[xX×]?\s+|[-•*]\s+)/.test(line) ||
      (!looksAddress && line.length <= 60 && !/^oi\b|^ola\b|^olá\b|^bom dia|^boa tarde|^boa noite/i.test(line));

    if (looksAddress && addressLines.length < 3) {
      addressLines.push(line);
      continue;
    }
    if (looksListItem && !/^oi\b|^ola\b|^olá\b/i.test(line)) {
      // skip pure greetings / thanks
      if (/^(obrigad|valeu|ok|blz|tudo bem)/i.test(line)) continue;
      itemLines.push(line.replace(/^\d+[xX×]?\s+/, '').trim());
    }
  }

  // Fallback: if no address detected, first long line; items = rest
  let address = addressLines.length ? addressLines.join(', ') : null;
  let items = itemLines.filter((n) => n.length >= 2).slice(0, 40);

  if (!address && lines.length >= 2) {
    const first = lines.find((l) => !PHONE_RE.test(l) && l.length > 12);
    if (first && ADDRESS_HINT.test(first)) {
      address = first;
      items = lines.filter((l) => l !== first && l.length >= 2).slice(0, 40);
    }
  }

  if (items.length === 0) {
    items = lines
      .filter((l) => !ADDRESS_HINT.test(l) && !(PHONE_RE.test(l) && l.replace(PHONE_RE, '').trim().length < 3))
      .slice(0, 40);
    PHONE_RE.lastIndex = 0;
  }

  // Deduplicate items
  const seen = new Set();
  items = items.filter((n) => {
    const k = n.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const phone_digits = phone ? normalizeWhatsAppDigitsLoose(phone) : null;

  return {
    address,
    phone,
    phone_digits: phone_digits && phone_digits.length >= 12 ? phone_digits : null,
    items,
    raw_lines: lines,
  };
}

/**
 * Distância em km (Haversine).
 */
export function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (Number(d) * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Filtra linhas do RPC por raio em torno do cliente.
 */
export function filterRpcRowsByRadius(rpcRows, lat, lng, radiusKm = 8) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return rpcRows || [];
  return (rpcRows || []).filter((row) => {
    if (row.lat == null || row.lng == null) return true;
    const d = haversineKm(lat, lng, row.lat, row.lng);
    return d <= radiusKm;
  });
}

/**
 * Mensagem de orçamento para WhatsApp.
 */
export function buildMapQuoteWhatsappMessage({ customerName, address, stores, items }) {
  const top = (stores || []).slice(0, 3);
  const lines = [];
  lines.push(`Olá${customerName ? ` ${customerName}` : ''}! Segue o orçamento FinMemory:`);
  if (address) lines.push(`📍 Região: ${address}`);
  lines.push('');

  if (top.length === 0) {
    lines.push('Ainda não achei preços no mapa para esses itens na sua região.');
    lines.push('Me confirma a lista ou o bairro que eu busco de novo.');
    return lines.join('\n');
  }

  for (const s of top) {
    lines.push(
      `🛒 *${s.storeName}* — R$ ${Number(s.total).toFixed(2).replace('.', ',')} (${s.coveredItems}/${s.totalItems} itens)`
    );
    for (const line of (s.lines || []).slice(0, 12)) {
      lines.push(`  • ${line.listName}: R$ ${Number(line.price).toFixed(2).replace('.', ',')}`);
    }
    lines.push('');
  }

  const unmatched = (items || []).filter((name) => {
    return !top.some((s) => s.lines?.some((l) => l.listName === name));
  });
  // Better: items not covered by best store
  const best = top[0];
  const missing = (items || []).filter(
    (name) => !best?.lines?.some((l) => l.listName.toLowerCase() === name.toLowerCase())
  );
  if (missing.length) {
    lines.push(`Itens sem preço no melhor mercado: ${missing.slice(0, 8).join(', ')}`);
  }

  lines.push('Qualquer dúvida, me chama aqui. 👋');
  return lines.join('\n');
}
