import { FM_CURRENCY_CODE, FM_CURRENCY_LABEL } from './constants';
import { registerLedgerTransactionOnChain } from './blockchainAudit';

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

export async function ensureWallet(supabase, userId) {
  const { data, error } = await supabase.rpc('fm_ensure_wallet', { p_user_id: userId });
  if (error) throw new Error(error.message);

  const { data: wallet, error: wErr } = await supabase
    .from('fm_wallets')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (wErr) throw new Error(wErr.message);
  return wallet || { id: data, user_id: userId };
}

export async function getWalletWithTransactions(supabase, userId, { limit = 30 } = {}) {
  const wallet = await ensureWallet(supabase, userId);
  const { data: transactions, error } = await supabase
    .from('fm_ledger_transactions')
    .select('*')
    .eq('wallet_id', wallet.id)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  return {
    wallet: {
      ...wallet,
      balance: roundMoney(wallet.balance),
      currency_code: wallet.currency_code || FM_CURRENCY_CODE,
      currency_label: FM_CURRENCY_LABEL,
    },
    transactions: transactions || [],
  };
}

export async function postLedgerTransaction(supabase, {
  userId,
  type,
  amount,
  status = 'confirmed',
  sourceType = null,
  sourceId = null,
  description,
  metadata = {},
  skipBlockchain = false,
}) {
  const amt = roundMoney(amount);
  if (!Number.isFinite(amt) || amt === 0) {
    throw new Error('Valor inválido para transação.');
  }
  if (amt > 0 && type === 'credit_redeemed') {
    throw new Error('Resgate deve usar valor negativo.');
  }
  if (amt < 0 && !['credit_redeemed', 'credit_reversed', 'admin_adjustment'].includes(type)) {
    throw new Error('Valor negativo não permitido para este tipo.');
  }

  const { data, error } = await supabase.rpc('fm_post_ledger_transaction', {
    p_user_id: userId,
    p_type: type,
    p_amount: amt,
    p_status: status,
    p_source_type: sourceType,
    p_source_id: sourceId,
    p_description: description,
    p_metadata: metadata,
    p_blockchain_tx_hash: null,
    p_blockchain_network: null,
    p_token_amount: null,
  });

  if (error) throw new Error(error.message);

  let txRow = null;
  if (data?.transaction_id) {
    const { data: row } = await supabase
      .from('fm_ledger_transactions')
      .select('*')
      .eq('id', data.transaction_id)
      .single();
    txRow = row;
    if (!skipBlockchain && row) {
      txRow = await registerLedgerTransactionOnChain(supabase, row);
    }
  }

  return {
    transaction: txRow,
    wallet_id: data?.wallet_id,
    balance: roundMoney(data?.balance),
  };
}

export async function redeemCredits(supabase, userId, amount, description = 'Resgate de créditos') {
  const amt = roundMoney(amount);
  if (amt <= 0) throw new Error('Informe um valor positivo para resgate.');
  return postLedgerTransaction(supabase, {
    userId,
    type: 'credit_redeemed',
    amount: -amt,
    description,
    sourceType: 'wallet',
    metadata: { action: 'redeem' },
  });
}
