/**
 * Emissor do cartão no modelo Pluggy: a instituição do item/conector Open Finance corresponde
 * ao banco emissor no extrato BR. Bandeira (creditData.brand) não é tratada aqui como logo institucional.
 *
 * @param {object | null | undefined} account — conta Pluggy (fetchAccounts)
 * @param {object | null | undefined} tx — transação Pluggy
 * @returns {boolean}
 */
export function isPluggyCreditCardMovement(account, tx) {
  const accType = String(account?.type || '').trim().toUpperCase();
  const sub = String(account?.subtype || '').trim().toUpperCase();
  if (accType === 'CREDIT' || sub === 'CREDIT_CARD') return true;

  const meta = tx?.creditCardMetadata;
  if (meta && typeof meta === 'object') {
    if (meta.installmentNumber != null || meta.totalInstallments != null || meta.totalAmount != null)
      return true;
    if (meta.billId != null || meta.cardNumber != null) return true;
  }

  const pd =
    tx?.paymentData && typeof tx.paymentData === 'object' ? tx.paymentData : null;
  const pm = String(pd?.paymentMethod || '')
    .trim()
    .toUpperCase();
  if (pm === 'CARTAO' || pm.includes('CARTAO')) return true;

  const oc = String(tx?.operationCategory || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (oc.includes('CARTAO')) return true;

  return false;
}

/**
 * @param {object | null | undefined} account
 * @param {{ name?: string | null; imageUrl?: string | null } | null} connectorMeta resultado de pickConnectorMeta
 * @returns {{ credit_institution_name: string | null; credit_institution_logo_url: string | null }}
 */
export function creditIssuerFromPluggyAccount(account, connectorMeta) {
  const meta = connectorMeta && typeof connectorMeta === 'object' ? connectorMeta : null;
  const connectorName =
    meta?.name != null && String(meta.name).trim() ? String(meta.name).trim().slice(0, 240) : null;

  const accProduct =
    account?.marketingName != null && String(account.marketingName).trim()
      ? String(account.marketingName).trim().slice(0, 240)
      : account?.name != null && String(account.name).trim()
        ? String(account.name).trim().slice(0, 240)
        : null;

  const credit_institution_name =
    connectorName || accProduct
      ? (connectorName || accProduct || '').slice(0, 240)
      : null;

  let credit_institution_logo_url =
    meta?.imageUrl != null && String(meta.imageUrl).trim() ? String(meta.imageUrl).trim() : null;
  const maxLen = 2048;
  if (credit_institution_logo_url && credit_institution_logo_url.length > maxLen) {
    credit_institution_logo_url = credit_institution_logo_url.slice(0, maxLen);
  }

  return { credit_institution_name, credit_institution_logo_url };
}
