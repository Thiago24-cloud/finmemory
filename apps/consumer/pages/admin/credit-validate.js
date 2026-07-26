import Head from 'next/head';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../api/auth/[...nextauth]';
import { canAccessAdminRoutes } from '../../lib/adminAccess';
import { canAccessForSession } from '../../lib/access-server';

export async function getServerSideProps(ctx) {
  try {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    if (!session?.user?.email) {
      return { redirect: { destination: '/login?callbackUrl=/admin/credit-validate', permanent: false } };
    }
    const allowed = await canAccessAdminRoutes(session.user.email, () => canAccessForSession(session));
    if (!allowed) {
      return { redirect: { destination: '/?msg=sem-acesso-admin', permanent: false } };
    }
    return { props: {} };
  } catch (err) {
    return { redirect: { destination: '/login?callbackUrl=/admin/credit-validate', permanent: false } };
  }
}

export default function AdminCreditValidatePage() {
  const [campaigns, setCampaigns] = useState([]);
  const [users, setUsers] = useState([]);
  const [userQuery, setUserQuery] = useState('');
  const [form, setForm] = useState({
    user_id: '',
    campaign_id: '',
    product_name: 'Óleo de Soja 900ml',
    product_brand: '',
    market_name: 'Atacadão',
    purchase_amount: '12.99',
  });
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/admin/campaigns?status=active')
      .then((r) => r.json())
      .then((d) => {
        const list = d.campaigns || [];
        setCampaigns(list);
        if (list[0]?.id) {
          setForm((f) => ({
            ...f,
            campaign_id: f.campaign_id || list[0].id,
            product_name: f.product_name || list[0].product_name,
          }));
        }
      })
      .catch(() => {});
  }, []);

  const searchUsers = useCallback(async (q) => {
    const params = q ? `?q=${encodeURIComponent(q)}` : '';
    const res = await fetch(`/api/admin/users-search${params}`);
    const data = await res.json();
    setUsers(data.users || []);
  }, []);

  useEffect(() => {
    searchUsers('');
  }, [searchUsers]);

  useEffect(() => {
    const t = setTimeout(() => searchUsers(userQuery), 300);
    return () => clearTimeout(t);
  }, [userQuery, searchUsers]);

  async function validatePurchase(e) {
    e.preventDefault();
    setErr('');
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch('/api/admin/campaigns/validate-purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          purchase_amount: Number(form.purchase_amount),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Falha');
      setResult(data);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Validar compra — Admin créditos</title>
      </Head>
      <div className="min-h-screen bg-[#f4f1ec] text-[#1a1a1a]">
        <header className="border-b border-black/10 bg-white/90 px-4 py-4 sm:px-6">
          <div className="mx-auto flex max-w-2xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-bold">Validar compra (simulada)</h1>
              <p className="text-sm text-gray-600">Concede crédito da campanha ao microvarejista.</p>
            </div>
            <Link href="/admin/credit-campaigns" className="text-sm text-[#2ECC49] hover:underline">
              ← Campanhas
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
          <form onSubmit={validatePurchase} className="rounded-2xl border border-black/10 bg-white p-5 space-y-4">
            <label className="block text-sm">
              <span className="text-gray-600">Buscar usuário</span>
              <input
                className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
                placeholder="e-mail ou nome"
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600">Usuário</span>
              <select
                required
                className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
                value={form.user_id}
                onChange={(e) => setForm((f) => ({ ...f, user_id: e.target.value }))}
              >
                <option value="">Selecione…</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name || u.email} ({u.email})
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-gray-600">Campanha ativa</span>
              <select
                required
                className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
                value={form.campaign_id}
                onChange={(e) => {
                  const c = campaigns.find((x) => x.id === e.target.value);
                  setForm((f) => ({
                    ...f,
                    campaign_id: e.target.value,
                    product_name: c?.product_name || f.product_name,
                  }));
                }}
              >
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — R$ {c.reward_amount}
                  </option>
                ))}
              </select>
            </label>
            {[
              ['product_name', 'Produto comprado'],
              ['product_brand', 'Marca'],
              ['market_name', 'Mercado'],
              ['purchase_amount', 'Valor pago (R$)'],
            ].map(([key, label]) => (
              <label key={key} className="block text-sm">
                <span className="text-gray-600">{label}</span>
                <input
                  className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              </label>
            ))}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[#2ECC49] py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? 'Validando…' : 'Validar e conceder crédito'}
            </button>
          </form>

          {err ? <p className="mt-4 text-sm text-red-600">{err}</p> : null}

          {result ? (
            <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-5 text-sm space-y-2">
              <p className="font-semibold text-green-800">{result.message}</p>
              <p>
                Novo saldo:{' '}
                <strong>
                  {Number(result.balance).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </strong>
              </p>
              {result.transaction?.blockchain_tx_hash ? (
                <p className="font-mono text-xs break-all text-gray-600">
                  Hash audit: {result.transaction.blockchain_tx_hash}
                </p>
              ) : null}
              <Link href="/carteira" className="inline-block text-[#2ECC49] underline">
                Ver carteira do usuário
              </Link>
            </div>
          ) : null}
        </main>
      </div>
    </>
  );
}
