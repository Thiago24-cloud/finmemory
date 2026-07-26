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
      return { redirect: { destination: '/login?callbackUrl=/admin/credit-campaigns', permanent: false } };
    }
    const allowed = await canAccessAdminRoutes(session.user.email, () => canAccessForSession(session));
    if (!allowed) {
      return { redirect: { destination: '/?msg=sem-acesso-admin', permanent: false } };
    }
    return { props: {} };
  } catch (err) {
    return { redirect: { destination: '/login?callbackUrl=/admin/credit-campaigns', permanent: false } };
  }
}

const STATUS_OPTIONS = ['draft', 'active', 'paused', 'ended'];

function fmtMoney(n) {
  return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function AdminCreditCampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({
    name: 'Cashback Óleo Parceiro',
    partner_name: 'Indústria Parceira',
    product_name: 'Óleo de Soja 900ml',
    product_brand: '',
    reward_amount: '2.00',
    budget_total: '1000.00',
    region: 'São Paulo',
    status: 'active',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const res = await fetch('/api/admin/campaigns');
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
      setCampaigns(data.campaigns || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createCampaign(e) {
    e.preventDefault();
    setMsg('');
    setErr('');
    try {
      const res = await fetch('/api/admin/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          reward_amount: Number(form.reward_amount),
          budget_total: Number(form.budget_total),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Falha ao criar');
      setMsg('Campanha criada.');
      load();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function setStatus(id, status) {
    setErr('');
    try {
      const res = await fetch(`/api/admin/campaigns/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error);
      load();
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <>
      <Head>
        <title>Campanhas de crédito — Admin</title>
      </Head>
      <div className="min-h-screen bg-[#f4f1ec] text-[#1a1a1a]">
        <header className="border-b border-black/10 bg-white/90 px-4 py-4 sm:px-6">
          <div className="mx-auto flex max-w-4xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-bold">Campanhas de crédito</h1>
              <p className="text-sm text-gray-600">Cashback patrocinado — orçamento e recompensa por produto.</p>
            </div>
            <div className="flex gap-3 text-sm">
              <Link href="/admin/credit-validate" className="text-[#2ECC49] hover:underline">
                Validar compra →
              </Link>
              <Link href="/admin" className="text-gray-600 hover:underline">
                ← Painel
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 space-y-8">
          {err ? <p className="text-sm text-red-600">{err}</p> : null}
          {msg ? <p className="text-sm text-green-700">{msg}</p> : null}

          <form onSubmit={createCampaign} className="rounded-2xl border border-black/10 bg-white p-5 space-y-3">
            <h2 className="font-semibold">Nova campanha</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ['name', 'Nome da campanha'],
                ['partner_name', 'Parceiro'],
                ['product_name', 'Produto'],
                ['product_brand', 'Marca (opcional)'],
                ['reward_amount', 'Recompensa (R$)'],
                ['budget_total', 'Orçamento total (R$)'],
                ['region', 'Região'],
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
              <label className="block text-sm">
                <span className="text-gray-600">Status inicial</span>
                <select
                  className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              type="submit"
              className="rounded-lg bg-[#2ECC49] px-4 py-2 text-sm font-semibold text-white hover:bg-[#27b03f]"
            >
              Criar campanha
            </button>
          </form>

          <section>
            <h2 className="font-semibold mb-3">Campanhas ({campaigns.length})</h2>
            {loading ? (
              <p className="text-sm text-gray-500">A carregar…</p>
            ) : (
              <ul className="space-y-3">
                {campaigns.map((c) => (
                  <li key={c.id} className="rounded-xl border border-black/10 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{c.name}</p>
                        <p className="text-sm text-gray-600">
                          {c.partner_name} · {c.product_name}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Recompensa {fmtMoney(c.reward_amount)} · Gasto {fmtMoney(c.budget_spent)} /{' '}
                          {fmtMoney(c.budget_total)} · {c.region || '—'}
                        </p>
                      </div>
                      <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-medium uppercase">
                        {c.status}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {STATUS_OPTIONS.filter((s) => s !== c.status).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setStatus(c.id, s)}
                          className="rounded border border-black/15 px-2 py-1 text-xs hover:bg-black/[0.03]"
                        >
                          → {s}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>
      </div>
    </>
  );
}
