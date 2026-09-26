import Head from 'next/head';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './api/auth/[...nextauth]';
import { LEDGER_TYPE_LABELS, LEDGER_STATUS_LABELS } from '../lib/credits/constants';

export async function getServerSideProps(ctx) {
  try {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    if (!session?.user?.supabaseId) {
      return { redirect: { destination: '/login?callbackUrl=/carteira', permanent: false } };
    }
    return { props: {} };
  } catch (err) {
    console.error('[carteira getServerSideProps]', err);
    return { redirect: { destination: '/login?callbackUrl=/carteira', permanent: false } };
  }
}

function fmtMoney(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 'R$ 0,00';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

export default function CarteiraPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const res = await fetch('/api/credits/wallet?limit=40');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data?.error || `Erro ${res.status}`);
        return;
      }
      setWallet(data.wallet);
      setTransactions(data.transactions || []);
    } catch (e) {
      setErr(e?.message || 'Falha ao carregar carteira');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <Head>
        <title>Carteira — FinMemory</title>
      </Head>
      <div className="min-h-screen bg-[#0f1419] text-white">
        <header className="border-b border-white/10 px-4 py-4 sm:px-6">
          <div className="mx-auto flex max-w-lg flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Carteira</h1>
              <p className="text-sm text-white/60">Créditos de campanhas e cashback — registro auditável.</p>
            </div>
            <Link href="/dashboard" className="text-sm font-medium text-[#2ECC49] hover:underline">
              ← Dashboard
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-lg px-4 py-6 sm:px-6">
          {loading ? (
            <p className="text-center text-sm text-white/50 py-12">A carregar…</p>
          ) : err ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-950/40 p-4 text-sm text-red-200">
              {err}
              <button type="button" onClick={load} className="mt-3 block text-[#2ECC49] underline">
                Tentar de novo
              </button>
            </div>
          ) : (
            <>
              <section className="rounded-2xl border border-[#2ECC49]/30 bg-gradient-to-br from-[#2ECC49]/15 to-transparent p-6">
                <p className="text-sm text-white/70">Saldo disponível</p>
                <p className="mt-1 text-4xl font-bold text-[#2ECC49]">{fmtMoney(wallet?.balance)}</p>
                <p className="mt-2 text-xs text-white/50">{wallet?.currency_label || 'Créditos FinMemory'}</p>
              </section>

              <p className="mt-6 mb-3 text-xs text-white/45">
                Cada crédito equivale a R$ 1,00 em benefícios dentro do ecossistema FinMemory. Transações
                confirmadas podem incluir hash de auditoria (blockchain-ready).
              </p>

              <h2 className="text-sm font-semibold text-white/80 mb-3">Histórico</h2>
              {transactions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-white/45">
                  Nenhuma movimentação ainda. Participe de campanhas para receber créditos.
                </div>
              ) : (
                <ul className="space-y-3">
                  {transactions.map((tx) => {
                    const positive = Number(tx.amount) > 0;
                    return (
                      <li
                        key={tx.id}
                        className="rounded-xl border border-white/10 bg-white/[0.04] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{tx.description}</p>
                            <p className="text-xs text-white/45 mt-1">
                              {LEDGER_TYPE_LABELS[tx.type] || tx.type} ·{' '}
                              {LEDGER_STATUS_LABELS[tx.status] || tx.status}
                            </p>
                            <p className="text-xs text-white/35 mt-0.5">{fmtDate(tx.created_at)}</p>
                          </div>
                          <span
                            className={`shrink-0 text-sm font-bold ${
                              positive ? 'text-[#2ECC49]' : 'text-amber-300'
                            }`}
                          >
                            {positive ? '+' : ''}
                            {fmtMoney(tx.amount)}
                          </span>
                        </div>
                        {tx.blockchain_tx_hash ? (
                          <p className="mt-2 text-[10px] font-mono text-white/35 break-all">
                            Audit: {tx.blockchain_tx_hash}
                            {tx.blockchain_network ? ` (${tx.blockchain_network})` : ''}
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </main>
      </div>
    </>
  );
}
