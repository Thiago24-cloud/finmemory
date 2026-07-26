export const FM_CURRENCY_CODE = 'FM_CREDIT';
export const FM_CURRENCY_LABEL = 'Créditos FinMemory';

export const LEDGER_TYPES = Object.freeze({
  CREDIT_ISSUED: 'credit_issued',
  CREDIT_REDEEMED: 'credit_redeemed',
  CREDIT_EXPIRED: 'credit_expired',
  CREDIT_REVERSED: 'credit_reversed',
  CASHBACK_GRANTED: 'cashback_granted',
  CAMPAIGN_REWARD: 'campaign_reward',
  ADMIN_ADJUSTMENT: 'admin_adjustment',
});

export const LEDGER_STATUS = Object.freeze({
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  FAILED: 'failed',
  REVERSED: 'reversed',
});

export const CAMPAIGN_STATUS = Object.freeze({
  DRAFT: 'draft',
  ACTIVE: 'active',
  PAUSED: 'paused',
  ENDED: 'ended',
});

export const VALIDATION_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
});

export const VALIDATION_SOURCES = Object.freeze({
  MANUAL: 'manual',
  SIMULATED: 'simulated',
  INVOICE: 'invoice',
  AGENT_PRICE_MATCH: 'agent_price_match',
});

export const LEDGER_TYPE_LABELS = {
  credit_issued: 'Crédito emitido',
  credit_redeemed: 'Resgate de crédito',
  credit_expired: 'Crédito expirado',
  credit_reversed: 'Estorno',
  cashback_granted: 'Cashback',
  campaign_reward: 'Recompensa de campanha',
  admin_adjustment: 'Ajuste administrativo',
};

export const LEDGER_STATUS_LABELS = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  failed: 'Falhou',
  reversed: 'Estornado',
};
