import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { getServerSession } from 'next-auth/next';
import { Check, Loader2, Store } from 'lucide-react';
import { authOptions } from '../api/auth/[...nextauth]';
import { canAccessAdminRoutes } from '../../lib/adminAccess';
import { canAccessForSession } from '../../lib/access-server';

export async function getServerSideProps(ctx) {
  try {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    if (!session?.user?.email) {
      return { redirect: { destination: '/login?callbackUrl=/admin/partner-stores', permanent: false } };
    }
    const allowed = await canAccessAdminRoutes(session.user.email, () => canAccessForSession(session));
    if (!allowed) {
      return { redirect: { destination: '/?msg=sem-acesso-admin', permanent: false } };
    }
    return { props: {} };
  } catch (err) {
    console.error('[admin/partner-stores getServerSideProps]', err);
    return { redirect: { destination: '/login?callbackUrl=/admin/partner-stores', permanent: false } };
  }
}

function AdminPartnerStoresContent() {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/partner-stores?needs_review=1');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Erro ao carregar lojas.');
        setStores([]);
        return;
      }
      setStores(data.stores || []);
    } catch {
      setError('Erro de rede.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const approve = async (storeId) => {
    setBusyId(storeId);
    try {
      const res = await fetch('/api/admin/partner-stores', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId, needs_review: false, active: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Não foi possível aprovar.');
        return;
      }
      setStores((list) => list.filter((s) => s.id !== storeId));
    } catch {
      setError('Erro de rede ao aprovar.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="min-h-screen bg-[#0c0c12] text-white px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <Link href="/admin" className="text-sm text-white/50 hover:text-white">
          ← Painel admin
        </Link>
        <h1 className="text-2xl font-bold mt-4 flex items-center gap-2">
          <Store className="h-7 w-7 text-[#39FF14]" aria-hidden />
          Lojas parceiras pendentes
        </h1>
        <p className="text-white/55 text-sm mt-2">
          Cadastros via <code className="text-[#39FF14]/90">/parceiros</code> ficam com{' '}
          <strong>needs_review</strong> até aprovação. Depois disso podem publicar ofertas no mapa.
        </p>

        {error ? (
          <p
            className="mt-4 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-[#39FF14]" aria-label="Carregando" />
          </div>
        ) : stores.length === 0 ? (
          <p className="mt-8 text-center text-white/45 text-sm">Nenhuma loja aguardando revisão.</p>
        ) : (
          <ul className="mt-6 space-y-3 list-none p-0 m-0">
            {stores.map((s) => (
              <li
                key={s.id}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between"
              >
                <div className="min-w-0">
                  <p className="font-semibold m-0 truncate">{s.name}</p>
                  <p className="text-xs text-white/45 mt-1 m-0 truncate">{s.address || '—'}</p>
                  {s.cnpj ? (
                    <p className="text-[10px] text-white/35 mt-1 m-0">CNPJ/CPF: {s.cnpj}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={busyId === s.id}
                  onClick={() => void approve(s.id)}
                  className="shrink-0 inline-flex items-center justify-center gap-2 rounded-lg bg-[#39FF14] px-4 py-2 text-sm font-bold text-[#050508] disabled:opacity-50"
                >
                  {busyId === s.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Check className="h-4 w-4" aria-hidden />
                  )}
                  Aprovar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

export default function AdminPartnerStoresPage() {
  return (
    <>
      <Head>
        <title>Lojas parceiras — Admin FinMemory</title>
      </Head>
      <AdminPartnerStoresContent />
    </>
  );
}
