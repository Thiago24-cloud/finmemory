import { CAMPAIGN_STATUS } from './constants';
import { postLedgerTransaction } from './walletService';

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

export function isCampaignActive(campaign, now = new Date()) {
  if (!campaign) return false;
  if (campaign.status !== CAMPAIGN_STATUS.ACTIVE) return false;
  const t = now.getTime();
  if (campaign.starts_at && new Date(campaign.starts_at).getTime() > t) return false;
  if (campaign.ends_at && new Date(campaign.ends_at).getTime() < t) return false;
  const spent = Number(campaign.budget_spent) || 0;
  const total = Number(campaign.budget_total) || 0;
  const reward = Number(campaign.reward_amount) || 0;
  return spent + reward <= total;
}

export async function listCampaigns(supabase, { status } = {}) {
  let q = supabase.from('fm_campaigns').select('*').order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data || [];
}

export async function getCampaignById(supabase, id) {
  const { data, error } = await supabase.from('fm_campaigns').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function createCampaign(supabase, payload) {
  const reward = roundMoney(payload.reward_amount);
  const budget = roundMoney(payload.budget_total);
  if (reward <= 0) throw new Error('Recompensa deve ser maior que zero.');
  if (budget < reward) throw new Error('Orçamento deve cobrir ao menos uma recompensa.');

  const row = {
    name: String(payload.name || '').trim(),
    partner_name: String(payload.partner_name || '').trim(),
    product_name: String(payload.product_name || '').trim(),
    product_brand: payload.product_brand ? String(payload.product_brand).trim() : null,
    product_identifier: payload.product_identifier ? String(payload.product_identifier).trim() : null,
    reward_amount: reward,
    budget_total: budget,
    budget_spent: 0,
    region: payload.region ? String(payload.region).trim() : null,
    starts_at: payload.starts_at || null,
    ends_at: payload.ends_at || null,
    status: payload.status || CAMPAIGN_STATUS.DRAFT,
    rules: payload.rules || {},
    updated_at: new Date().toISOString(),
  };

  if (!row.name || !row.partner_name || !row.product_name) {
    throw new Error('Nome, parceiro e produto são obrigatórios.');
  }

  const { data, error } = await supabase.from('fm_campaigns').insert(row).select('*').single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateCampaignStatus(supabase, id, status) {
  const allowed = Object.values(CAMPAIGN_STATUS);
  if (!allowed.includes(status)) throw new Error('Status inválido.');
  const { data, error } = await supabase
    .from('fm_campaigns')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Concede crédito de campanha ao usuário (atômico: budget + ledger).
 */
export async function grantCampaignReward(supabase, {
  userId,
  campaignId,
  purchaseValidationId = null,
  metadata = {},
}) {
  const { data: campaign, error: cErr } = await supabase
    .from('fm_campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();
  if (cErr || !campaign) throw new Error('Campanha não encontrada.');

  if (!isCampaignActive(campaign)) {
    throw new Error('Campanha inativa, fora do prazo ou sem orçamento.');
  }

  const reward = roundMoney(campaign.reward_amount);
  const newSpent = roundMoney(Number(campaign.budget_spent) + reward);
  if (newSpent > Number(campaign.budget_total)) {
    throw new Error('Orçamento da campanha esgotado.');
  }

  const description = `Crédito recebido pela campanha ${campaign.name}`;
  const txMeta = {
    campaign_name: campaign.name,
    partner_name: campaign.partner_name,
    product_name: campaign.product_name,
    product_brand: campaign.product_brand,
    region: campaign.region,
    reward_amount: reward,
    ...metadata,
  };

  const ledger = await postLedgerTransaction(supabase, {
    userId,
    type: 'campaign_reward',
    amount: reward,
    sourceType: 'campaign',
    sourceId: campaignId,
    description,
    metadata: txMeta,
  });

  const { error: updErr } = await supabase
    .from('fm_campaigns')
    .update({
      budget_spent: newSpent,
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId)
    .eq('budget_spent', campaign.budget_spent);

  if (updErr) {
    console.error('[campaignService] budget update failed after ledger post', updErr.message);
    throw new Error('Falha ao atualizar orçamento da campanha.');
  }

  if (purchaseValidationId) {
    await supabase
      .from('fm_purchase_validations')
      .update({
        validation_status: 'approved',
        ledger_transaction_id: ledger.transaction?.id || null,
      })
      .eq('id', purchaseValidationId);
  }

  return {
    campaign: { ...campaign, budget_spent: newSpent },
    ledger,
  };
}
