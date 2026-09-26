import { VALIDATION_SOURCES, VALIDATION_STATUS } from './constants';
import { grantCampaignReward } from './campaignService';

export async function createPurchaseValidation(supabase, payload) {
  const row = {
    user_id: payload.user_id,
    campaign_id: payload.campaign_id || null,
    product_name: String(payload.product_name || '').trim(),
    product_brand: payload.product_brand ? String(payload.product_brand).trim() : null,
    market_name: payload.market_name ? String(payload.market_name).trim() : null,
    purchase_amount:
      payload.purchase_amount != null ? Number(payload.purchase_amount) : null,
    validation_status: VALIDATION_STATUS.PENDING,
    validation_source: payload.validation_source || VALIDATION_SOURCES.SIMULATED,
    metadata: payload.metadata || {},
  };

  if (!row.user_id || !row.product_name) {
    throw new Error('Usuário e produto são obrigatórios.');
  }

  const { data, error } = await supabase
    .from('fm_purchase_validations')
    .insert(row)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Valida compra simulada e concede crédito da campanha.
 */
export async function validatePurchaseAndGrantCredit(supabase, {
  userId,
  campaignId,
  productName,
  productBrand,
  marketName,
  purchaseAmount,
  validationSource = VALIDATION_SOURCES.SIMULATED,
  metadata = {},
}) {
  if (!userId || !campaignId) {
    throw new Error('Usuário e campanha são obrigatórios.');
  }

  const { data: existing } = await supabase
    .from('fm_purchase_validations')
    .select('id, validation_status')
    .eq('user_id', userId)
    .eq('campaign_id', campaignId)
    .eq('validation_status', VALIDATION_STATUS.APPROVED)
    .eq('product_name', String(productName || '').trim())
    .gte('created_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString())
    .limit(1);

  if (existing?.length) {
    throw new Error('Esta compra já foi validada nas últimas 24h para esta campanha.');
  }

  const validation = await createPurchaseValidation(supabase, {
    user_id: userId,
    campaign_id: campaignId,
    product_name: productName,
    product_brand: productBrand,
    market_name: marketName,
    purchase_amount: purchaseAmount,
    validation_source: validationSource,
    metadata,
  });

  const result = await grantCampaignReward(supabase, {
    userId,
    campaignId,
    purchaseValidationId: validation.id,
    metadata: {
      market_name: marketName,
      purchase_amount: purchaseAmount,
      validation_source: validationSource,
      ...metadata,
    },
  });

  return {
    validation: { ...validation, validation_status: VALIDATION_STATUS.APPROVED },
    ...result,
  };
}

export async function listPurchaseValidations(supabase, { userId, limit = 20 } = {}) {
  let q = supabase
    .from('fm_purchase_validations')
    .select('*, campaign:fm_campaigns(id, name, partner_name)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (userId) q = q.eq('user_id', userId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data || [];
}
