function isValidHttpUrl(value) {
  try {
    const u = new URL(String(value || '').trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * @param {unknown} item
 * @returns {{ isValid: boolean, errors: Array<{ field: string, reason: string }> }}
 */
export function validateUnifiedProviderItem(item) {
  /** @type {Array<{ field: string, reason: string }>} */
  const errors = [];
  const it = item && typeof item === 'object' ? item : null;

  if (!it) {
    return {
      isValid: false,
      errors: [{ field: 'item', reason: 'must be an object' }],
    };
  }

  if (!String(it.product_name || '').trim()) {
    errors.push({ field: 'product_name', reason: 'required non-empty string' });
  }

  const currentPrice = Number(it.current_price);
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
    errors.push({ field: 'current_price', reason: 'must be a positive number' });
  }

  if (it.original_price != null) {
    const originalPrice = Number(it.original_price);
    if (!Number.isFinite(originalPrice) || originalPrice <= 0) {
      errors.push({ field: 'original_price', reason: 'must be null or positive number' });
    }
  }

  if (!String(it.unit || '').trim()) {
    errors.push({ field: 'unit', reason: 'required normalized string' });
  }

  if (!String(it.locality_city || '').trim()) {
    errors.push({ field: 'locality_city', reason: 'required non-empty string' });
  }

  if (String(it.locality_state || '').toUpperCase() !== 'SP') {
    errors.push({ field: 'locality_state', reason: 'must be SP' });
  }

  if (!['Capital', 'Interior', 'Litoral'].includes(String(it.locality_region || ''))) {
    errors.push({ field: 'locality_region', reason: 'must be Capital, Interior or Litoral' });
  }

  const dddCode = Number(it.ddd_code);
  if (!Number.isInteger(dddCode) || dddCode <= 0) {
    errors.push({ field: 'ddd_code', reason: 'must be a positive integer' });
  }

  if (typeof it.is_statewide !== 'boolean') {
    errors.push({ field: 'is_statewide', reason: 'must be boolean' });
  }

  const expiry = new Date(String(it.expiry_date || '').trim());
  if (!String(it.expiry_date || '').trim() || Number.isNaN(expiry.getTime())) {
    errors.push({ field: 'expiry_date', reason: 'must be a valid ISO date string' });
  }

  if (!isValidHttpUrl(it.image_url)) {
    errors.push({ field: 'image_url', reason: 'must be a valid http(s) URL' });
  }

  const md = it.metadata;
  if (!md || typeof md !== 'object') {
    errors.push({ field: 'metadata', reason: 'must be an object' });
  } else {
    if (!String(md.source || '').trim()) {
      errors.push({ field: 'metadata.source', reason: 'required non-empty string' });
    }
    if (typeof md.validity_inferred !== 'boolean') {
      errors.push({ field: 'metadata.validity_inferred', reason: 'must be boolean' });
    }
    if (!String(md.extraction_strategy || '').trim()) {
      errors.push({ field: 'metadata.extraction_strategy', reason: 'required non-empty string' });
    }
  }

  return { isValid: errors.length === 0, errors };
}

