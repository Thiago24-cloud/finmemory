import { createHash } from 'crypto';

export function shouldMockBlockchainAudit() {
  const v = String(process.env.BLOCKCHAIN_AUDIT_MOCK || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export function createBlockchainAuditRecord(params) {
  if (!shouldMockBlockchainAudit()) {
    return { blockchain_tx_hash: null, blockchain_network: null, token_amount: null };
  }

  const payload = [
    params.transactionId || '',
    params.createdAt || new Date().toISOString(),
    String(params.amount ?? ''),
    params.userId || '',
  ].join('|');

  const hash = createHash('sha256').update(payload).digest('hex');
  return {
    blockchain_tx_hash: `0x${hash.slice(0, 64)}`,
    blockchain_network: process.env.BLOCKCHAIN_AUDIT_NETWORK || 'finmemory-mock-testnet',
    token_amount: Number(params.amount) || null,
  };
}

export async function registerLedgerTransactionOnChain(supabase, transactionRow) {
  if (!shouldMockBlockchainAudit() || !transactionRow?.id) {
    return transactionRow;
  }

  const audit = createBlockchainAuditRecord({
    transactionId: transactionRow.id,
    amount: transactionRow.amount,
    createdAt: transactionRow.created_at,
    userId: transactionRow.user_id,
  });

  const { data, error } = await supabase
    .from('fm_ledger_transactions')
    .update({
      blockchain_tx_hash: audit.blockchain_tx_hash,
      blockchain_network: audit.blockchain_network,
      token_amount: audit.token_amount,
    })
    .eq('id', transactionRow.id)
    .select('*')
    .single();

  if (error) {
    console.warn('[blockchainAudit] patch hash failed:', error.message);
    return { ...transactionRow, ...audit };
  }
  return data;
}
