import { parseBrazilianPrice } from './mapQuickAddCore.js';
import { normalizeUnit } from './ingest/providers/base.js';

function asNonEmptyString(value) {
  const t = String(value || '').trim();
  return t || null;
}

function cleanProductName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s.,%/-]/g, ' ')
    .replace(/r\$\s*\d+[.,]?\d*/gi, ' ')
    .replace(/\b\d+[.,]\d{2}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractPriceFromText(value) {
  const text = String(value || '').trim();
  if (!text) return null;

  const rsMatch = text.match(/r\$\s*([\d.]+,\d{2}|[\d.]+)/i);
  if (rsMatch?.[1]) {
    const n = parseBrazilianPrice(rsMatch[1]);
    if (Number.isFinite(n) && n > 0) return Number(n);
  }

  const decimalMatch = text.match(/(\d+[.,]\d{2})/);
  if (decimalMatch?.[1]) {
    const n = parseBrazilianPrice(decimalMatch[1]);
    if (Number.isFinite(n) && n > 0) return Number(n);
  }

  return null;
}

function coercePositivePrice(rawPrice, fallbackText) {
  const numeric = Number(rawPrice);
  if (Number.isFinite(numeric) && numeric > 0) return Number(numeric);

  const parsedFromRaw = extractPriceFromText(rawPrice);
  if (parsedFromRaw != null) return parsedFromRaw;

  const parsedFromText = extractPriceFromText(fallbackText);
  if (parsedFromText != null) return parsedFromText;

  return null;
}

export function normalizeQueuedProduto(raw) {
  const originalName =
    asNonEmptyString(raw?.nome) ||
    asNonEmptyString(raw?.name) ||
    asNonEmptyString(raw?.product_name) ||
    '';
  const name = cleanProductName(originalName);

  const price = coercePositivePrice(
    raw?.current_price ?? raw?.preco ?? raw?.price ?? raw?.valor,
    originalName
  );
  const imageUrl =
    asNonEmptyString(raw?.image_url) ||
    asNonEmptyString(raw?.imagem_url) ||
    asNonEmptyString(raw?.promo_image_url);
  const unit = normalizeUnit(raw?.unit ?? raw?.unidade);
  const validUntil =
    asNonEmptyString(raw?.expiry_date) ||
    asNonEmptyString(raw?.validade) ||
    asNonEmptyString(raw?.valid_until) ||
    asNonEmptyString(raw?.expires_at);

  return {
    name: name || originalName || 'Produto sem nome',
    price,
    image_url: imageUrl,
    unit,
    valid_until: validUntil,
    raw,
  };
}

export function splitProdutosByPublishReadiness(produtos) {
  const normalized = (Array.isArray(produtos) ? produtos : []).map(normalizeQueuedProduto);
  const ready = [];
  const pendingImage = [];
  const invalid = [];

  for (const p of normalized) {
    if (!Number.isFinite(p.price) || p.price <= 0) {
      invalid.push({ ...p.raw, _reason: 'price_invalid', _normalized_name: p.name });
      continue;
    }
    ready.push(p);
  }

  return { ready, pendingImage, invalid };
}
