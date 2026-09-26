'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Clock, ShieldCheck } from 'lucide-react';
import { useBridgeContext } from './BridgeContext';
import { fmtCurrency, fmtDateTime } from '../../../lib/adm/bridgeFormat';

function txLabel(type) {
  if (type === 'credit_issued') return 'Crédito recebido';
  if (type === 'cashback_granted') return 'Cashback';
  if (type === 'campaign_reward') return 'Recompensa de campanha';
  if (type === 'credit_redeemed') return 'Crédito utilizado';
  if (type === 'admin_adjustment') return 'Ajuste administrativo';
  return type;
}

export function BridgeCarteira() {
  const { selectedMerchant } = useBridgeContext();
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    if (!selectedMerchant?.user_id) return;
    setLoading(true);
    setErr('');
    try {
      const res = await fetch(
        `/api/parceiros/adm/bridge/wallet?user_id=${encodeURIComponent(selectedMerchant.user_id)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
      setWallet(data.wallet);
      setTransactions(data.transactions || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [selectedMerchant?.user_id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!selectedMerchant) {
    return <p className="text-sm fm-bridge-page-sub">Selecione um comerciante acima para ver a carteira.</p>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl fm-bridge-page-title">Carteira</h1>
        <p className="fm-bridge-page-sub mt-1">Seus créditos e histórico de transações.</p>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="h-36 fm-bridge-wallet-card animate-pulse rounded-xl opacity-50" />
          <div className="h-48 fm-bridge-card animate-pulse" />
        </div>
      ) : err ? (
        <p className="text-sm text-destructive">{err}</p>
      ) : (
        <>
          {/* Card saldo — verde Replit */}
          <div className="fm-bridge-wallet-card relative overflow-hidden rounded-xl text-white">
            <ShieldCheck
              className="absolute top-0 right-0 m-8 w-32 h-32 opacity-10 pointer-events-none"
              strokeWidth={1.25}
            />
            <div className="p-6 md:p-8 relative z-10">
              <p className="text-sm font-medium text-white/80">Saldo FinMemory</p>
              <p className="text-4xl md:text-5xl font-bold tracking-tight mt-1">
                {fmtCurrency(wallet?.balance)}
              </p>
              <p className="text-sm text-white/80 mt-4 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                Protegido por registro auditável
              </p>
            </div>
          </div>

          {/* Histórico */}
          <div className="fm-bridge-card overflow-hidden">
            <div className="p-6 pb-4 border-b border-[#e8ece9]">
              <h2 className="font-semibold text-[#111827] text-lg">Histórico de Transações</h2>
              <p className="text-sm fm-bridge-page-sub mt-0.5">
                Todas as movimentações de créditos da sua conta
              </p>
            </div>
            <div className="p-6 pt-4">
              {transactions.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="w-12 h-12 text-[#9ca3af] mx-auto mb-4 opacity-50" />
                  <p className="text-[#6b7280] font-medium">Nenhuma transação encontrada</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {transactions.map((tx) => {
                    const positive = Number(tx.amount) > 0;
                    return (
                      <div
                        key={tx.id}
                        className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-[#e8ece9] pb-6 last:border-0 last:pb-0"
                      >
                        <div className="flex items-start gap-4 min-w-0">
                          <div
                            className={`mt-0.5 p-2 rounded-full shrink-0 ${
                              positive
                                ? 'bg-green-100 text-green-700'
                                : 'bg-orange-100 text-orange-700'
                            }`}
                          >
                            {positive ? (
                              <ArrowUpRight className="w-4 h-4" />
                            ) : (
                              <ArrowDownRight className="w-4 h-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-[#111827]">{txLabel(tx.type)}</p>
                            <p className="text-sm text-[#6b7280] mt-0.5">{fmtDateTime(tx.created_at)}</p>
                            {tx.description ? (
                              <p className="text-sm text-[#6b7280] mt-1">{tx.description}</p>
                            ) : null}
                            {tx.blockchain_tx_hash ? (
                              <span className="inline-block mt-2 text-[10px] font-mono text-[#6b7280] bg-[#f3f4f6] border border-[#e5e7eb] rounded-md px-2 py-1">
                                Registro auditável: {tx.blockchain_tx_hash.slice(0, 16)}…
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <span
                          className={`text-lg font-bold whitespace-nowrap shrink-0 ${
                            positive ? 'text-green-600' : 'text-[#111827]'
                          }`}
                        >
                          {positive ? '+' : ''}
                          {fmtCurrency(tx.amount)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
