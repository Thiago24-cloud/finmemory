import Head from 'next/head';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './api/auth/[...nextauth]';
import { canAccessAdminRoutes } from '../lib/adminAccess';
import { canAccessForSession } from '../lib/access-server';

export async function getServerSideProps(ctx) {
  try {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    if (!session?.user?.email) {
      return { redirect: { destination: '/login?callbackUrl=/demo/investor', permanent: false } };
    }
    const allowed = await canAccessAdminRoutes(session.user.email, () => canAccessForSession(session));
    if (!allowed) {
      return { redirect: { destination: '/?msg=sem-acesso-admin', permanent: false } };
    }
    return { props: {} };
  } catch (err) {
    return { redirect: { destination: '/login?callbackUrl=/demo/investor', permanent: false } };
  }
}

function fmtMoney(n) {
  return Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const STEPS = [
  { id: 1, title: 'Inteligência de preços', desc: 'Mapa com milhares de pontos de preço em SP.' },
  { id: 2, title: 'Campanha patrocinada', desc: 'Indústria financia cashback por produto/região.' },
  { id: 3, title: 'Validação de compra', desc: 'Microvarejista compra no mercado — crédito concedido.' },
  { id: 4, title: 'Carteira + auditoria', desc: 'Saldo visível + hash blockchain-ready (mock).' },
];

export default function DemoInvestorPage() {
  const [step, setStep] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [simulateMsg, setSimulateMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/demo/investor');
      const json = await res.json();
      if (res.ok) setData(json);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function runSimulation() {
    setSimulateMsg('');
    const campaign = data?.active_campaigns?.[0];
    const user = data?.demo_user;
    if (!campaign || !user) {
      setSimulateMsg('Seed demo necessário — rode scripts/seed-fm-credits-demo.mjs');
      return;
    }
    const res = await fetch('/api/admin/campaigns/validate-purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: user.id,
        campaign_id: campaign.id,
        product_name: campaign.product_name,
        market_name: 'Atacadão Demo',
        purchase_amount: 11.9,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setSimulateMsg(json.error || 'Falha na simulação');
      return;
    }
    setSimulateMsg(`Crédito concedido: ${fmtMoney(json.balance)}`);
    setStep(4);
    load();
  }

  return (
    <>
      <Head>
        <title>Demo investidor — FinMemory Credits</title>
      </Head>
      <div className="min-h-screen bg-[#0a0e14] text-white">
        <header className="border-b border-white/10 px-4 py-5 sm:px-8">
          <div className="mx-auto max-w-4xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-[#2ECC49]">MVP · Price Intelligence + Credits</p>
              <h1 className="text-2xl font-bold mt-1">Loop completo para investidor</h1>
            </div>
            <Link href="/admin" className="text-sm text-white/60 hover:text-white">
              Admin →
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-4xl px-4 py-8 sm:px-8">
          <div className="grid gap-4 sm:grid-cols-4 mb-8">
            {STEPS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStep(s.id)}
                className={`rounded-xl border p-4 text-left transition ${
                  step === s.id
                    ? 'border-[#2ECC49] bg-[#2ECC49]/10'
                    : 'border-white/10 bg-white/[0.03] hover:border-white/20'
                }`}
              >
                <span className="text-xs text-white/40">Passo {s.id}</span>
                <p className="font-semibold text-sm mt-1">{s.title}</p>
              </button>
            ))}
          </div>

          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 min-h-[220px]">
            <p className="text-white/70">{STEPS[step - 1]?.desc}</p>

            {loading ? (
              <p className="mt-6 text-sm text-white/40">Carregando dados…</p>
            ) : (
              <div className="mt-6 space-y-4 text-sm">
                {step === 1 && (
                  <>
                    <p>
                      Pontos de preço (7 dias):{' '}
                      <strong>{data?.map_stats?.price_points_last_7d ?? '—'}</strong>
                    </p>
                    <Link href="/mapa" className="text-[#2ECC49] underline">
                      Abrir mapa Caça-Preço
                    </Link>
                  </>
                )}
                {step === 2 && (
                  <>
                    <p>Campanhas ativas: {data?.active_campaigns?.length ?? 0}</p>
                    {data?.active_campaigns?.[0] ? (
                      <div className="rounded-lg bg-black/30 p-4">
                        <p className="font-semibold">{data.active_campaigns[0].name}</p>
                        <p className="text-white/60">
                          {data.active_campaigns[0].product_name} · Recompensa{' '}
                          {fmtMoney(data.active_campaigns[0].reward_amount)}
                        </p>
                      </div>
                    ) : (
                      <p className="text-amber-300">Nenhuma campanha ativa — rode o seed.</p>
                    )}
                    <Link href="/admin/credit-campaigns" className="text-[#2ECC49] underline">
                      Gerir campanhas
                    </Link>
                  </>
                )}
                {step === 3 && (
                  <>
                    <p>
                      Usuário demo: {data?.demo_user?.name || data?.demo_user?.email || '—'}
                    </p>
                    <button
                      type="button"
                      onClick={runSimulation}
                      className="rounded-lg bg-[#2ECC49] px-4 py-2 font-semibold text-black"
                    >
                      Simular compra + crédito
                    </button>
                    {simulateMsg ? <p className="text-[#2ECC49]">{simulateMsg}</p> : null}
                  </>
                )}
                {step === 4 && (
                  <>
                    <p>
                      Saldo carteira: <strong className="text-[#2ECC49]">{fmtMoney(data?.wallet?.balance)}</strong>
                    </p>
                    <p className="text-white/50">
                      Auditoria mock: {data?.blockchain_audit_mock ? 'ativada' : 'desativada'} (
                      BLOCKCHAIN_AUDIT_MOCK)
                    </p>
                    {data?.transactions?.[0]?.blockchain_tx_hash ? (
                      <p className="font-mono text-xs break-all text-white/40">
                        {data.transactions[0].blockchain_tx_hash}
                      </p>
                    ) : null}
                    <Link href="/carteira" className="text-[#2ECC49] underline">
                      Carteira do usuário
                    </Link>
                  </>
                )}
              </div>
            )}
          </section>
        </main>
      </div>
    </>
  );
}
