import Head from 'next/head';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../api/auth/[...nextauth]';
import { canAccessAdminRoutes } from '../../lib/adminAccess';
import { canAccess } from '../../lib/access-server';

export async function getServerSideProps(ctx) {
  try {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    if (!session?.user?.email) {
      return { redirect: { destination: '/login?callbackUrl=/admin/financeiro', permanent: false } };
    }
    const allowed = await canAccessAdminRoutes(session.user.email, () => canAccess(session.user.email));
    if (!allowed) {
      return { redirect: { destination: '/?msg=sem-acesso-admin', permanent: false } };
    }
    return { props: {} };
  } catch (err) {
    console.error('[admin/financeiro getServerSideProps]', err);
    return { redirect: { destination: '/login?callbackUrl=/admin/financeiro', permanent: false } };
  }
}

function fmt(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

const SCOPES = [
  { id: 'pagantes', label: 'Com cliente Stripe', desc: 'Quem tem cus_… na BD (ligação a pagamentos).' },
  { id: 'plano', label: 'Plano / Plus na BD', desc: 'Ativo, plano ≠ free, Plus ou Stripe.' },
  { id: 'todos', label: 'Todos (amostra)', desc: 'Até 300 linhas; visão geral.' },
];

export default function AdminFinanceiroPage() {
  const [scope, setScope] = useState('pagantes');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [payload, setPayload] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const params = new URLSearchParams({ scope });
      const res = await fetch(`/api/admin/financeiro?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data?.error || `Erro ${res.status}`);
        setPayload(null);
        return;
      }
      setPayload(data);
    } catch (e) {
      setErr(e?.message || 'Falha ao carregar');
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = payload?.rows || [];
  const summary = payload?.summary;

  return (
    <>
      <Head>
        <title>Financeiro (admin) — FinMemory</title>
      </Head>
      <div className="min-h-screen bg-[#f4f1ec] text-[#1a1a1a]">
        <header className="border-b border-black/10 bg-white/90 px-4 py-4 sm:px-6">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Financeiro</h1>
              <p className="text-sm text-gray-600">
                Cruzamento só leitura entre a BD (Stripe / plano) — não altera dados nem chama a API da Stripe.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/admin" className="text-sm font-medium text-[#2ECC49] hover:underline">
                ← Painel operacional
              </Link>
              <button
                type="button"
                onClick={() => load()}
                disabled={loading}
                className="rounded-lg border border-black/15 bg-white px-3 py-1.5 text-sm font-medium hover:bg-black/[0.03] disabled:opacity-50"
              >
                {loading ? 'A carregar…' : 'Atualizar'}
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <div className="flex flex-wrap gap-2">
            {SCOPES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setScope(s.id)}
                className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                  scope === s.id
                    ? 'bg-[#2ECC49] text-white shadow-sm'
                    : 'bg-white/80 text-gray-700 ring-1 ring-black/10 hover:ring-[#2ECC49]/40'
                }`}
                title={s.desc}
              >
                {s.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">{SCOPES.find((s) => s.id === scope)?.desc}</p>

          {err ? (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{err}</p>
          ) : null}

          {summary && !err ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Com Stripe na BD</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{summary.com_stripe_customer}</p>
              </div>
              <div className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">plano_ativo</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{summary.plano_ativo_true}</p>
              </div>
              <div className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Stripe + plano free inativo</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-700">
                  {summary.stripe_mas_plano_free_inativo}
                </p>
                <p className="mt-1 text-xs text-gray-500">Possível dessincronização; rever webhook ou sync.</p>
              </div>
            </div>
          ) : null}

          <div className="mt-6 overflow-x-auto rounded-xl border border-black/10 bg-white shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-black/10 bg-black/[0.02] text-xs font-semibold uppercase tracking-wide text-gray-600">
                <tr>
                  <th className="whitespace-nowrap px-3 py-2">Email</th>
                  <th className="whitespace-nowrap px-3 py-2">Cliente Stripe</th>
                  <th className="whitespace-nowrap px-3 py-2">Sub Stripe</th>
                  <th className="whitespace-nowrap px-3 py-2">status (BD)</th>
                  <th className="whitespace-nowrap px-3 py-2">Plano</th>
                  <th className="whitespace-nowrap px-3 py-2">Ativo</th>
                  <th className="whitespace-nowrap px-3 py-2">Plus (BD)</th>
                  <th className="whitespace-nowrap px-3 py-2">Atualizado</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                      A carregar…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                      Nenhuma linha neste filtro.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const cus = String(r.stripe_customer_id || '').trim();
                    const sub = String(r.stripe_subscription_id || '').trim();
                    const st = String(r.stripe_subscription_status || '').trim() || '—';
                    const plan = String(r.plano || 'free').toLowerCase();
                    const active = Boolean(r.plano_ativo);
                    const plus = Boolean(r.finmemory_plus_active);
                    const warn = cus && !active && plan === 'free';
                    return (
                      <tr
                        key={r.id}
                        className={`border-b border-black/[0.06] ${warn ? 'bg-amber-50/80' : ''}`}
                      >
                        <td className="max-w-[220px] truncate px-3 py-2 font-medium text-gray-900" title={r.email}>
                          {r.email || '—'}
                        </td>
                        <td className="max-w-[140px] truncate px-3 py-2 font-mono text-xs" title={cus || ''}>
                          {cus ? `${cus.slice(0, 14)}…` : '—'}
                        </td>
                        <td className="max-w-[120px] truncate px-3 py-2 font-mono text-xs" title={sub || ''}>
                          {sub ? `${sub.slice(0, 10)}…` : '—'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">{st}</td>
                        <td className="whitespace-nowrap px-3 py-2">{plan}</td>
                        <td className="whitespace-nowrap px-3 py-2">{active ? 'sim' : 'não'}</td>
                        <td className="whitespace-nowrap px-3 py-2">{plus ? 'sim' : 'não'}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-gray-600">{fmt(r.plano_atualizado_em)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {payload?.count != null ? (
            <p className="mt-3 text-center text-xs text-gray-500">
              {payload.count} linha(s) · scope={payload.scope} · limit≤{payload.limit}
            </p>
          ) : null}
        </main>
      </div>
    </>
  );
}
