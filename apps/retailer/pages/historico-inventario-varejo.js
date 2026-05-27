import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { Share2 } from 'lucide-react';
import { getServerSession } from 'next-auth/next';
import { toast } from 'sonner';
import { authOptions } from './api/auth/[...nextauth]';
import { canAccessForSession } from '../lib/access-server';
import { canUseRestrictedFeatures } from '../lib/restrictedFeatureAccess';
import { isVarejistaUser } from '../lib/userType';
import {
  shareRetailInventoryCsv,
  retailInventoryCsvFilename,
} from '../lib/shareRetailInventoryCsv';

export async function getServerSideProps(ctx) {
  try {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    if (!session?.user?.email) {
      return { redirect: { destination: '/login?callbackUrl=/historico-inventario-varejo', permanent: false } };
    }
    const allowed = await canAccessForSession(session);
    if (!allowed) {
      return { redirect: { destination: '/?msg=nao-cadastrado', permanent: false } };
    }
    if (!canUseRestrictedFeatures(session.user.email)) {
      return { redirect: { destination: '/em-breve', permanent: false } };
    }
    if (!isVarejistaUser(session.user)) {
      return { redirect: { destination: '/escolher-perfil', permanent: false } };
    }
    return { props: {} };
  } catch {
    return { redirect: { destination: '/login?callbackUrl=/historico-inventario-varejo', permanent: false } };
  }
}

function formatBRL(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n));
}

function formatLoteDate(iso) {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function HistoricoInventarioVarejoPage() {
  const { status } = useSession();
  const router = useRouter();
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sharingId, setSharingId] = useState(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  const loadLotes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/varejo/inventario/list');
      const data = await res.json();
      if (res.ok) setLotes(data.lotes || []);
      else setLotes([]);
    } catch {
      setLotes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') void loadLotes();
  }, [status, loadLotes]);

  const handleShareLote = async (lote) => {
    setSharingId(lote.id);
    try {
      const res = await fetch(`/api/varejo/inventario/${lote.id}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Não foi possível carregar o lote.');
        return;
      }
      const rows = (data.itens || []).map((row) => ({
        ean: row.ean,
        nome: row.nome,
        quantidade: row.quantidade,
        preco: row.preco,
      }));
      const created = lote.created_at ? new Date(lote.created_at) : new Date();
      const outcome = await shareRetailInventoryCsv(rows, {
        filename: retailInventoryCsvFilename(created),
        title: lote.nome_lote || 'Inventário FinMemory',
      });
      if (outcome === 'cancelled') return;
      if (outcome === 'fallback') {
        toast.message('Arquivo baixado — envie pelo app que preferir.');
      } else {
        toast.success('Inventário compartilhado.');
      }
    } catch {
      toast.error('Erro ao exportar o lote.');
    } finally {
      setSharingId(null);
    }
  };

  return (
    <>
      <Head>
        <title>Histórico de lotes | FinMemory</title>
      </Head>

      <div className="min-h-screen bg-background pb-24">
        <div className="sticky top-0 z-10 bg-card border-b border-[#1E2A3A] px-5 py-4">
          <div className="flex items-center gap-3 max-w-lg mx-auto">
            <Link
              href="/parceiros/painel"
              className="text-sm font-medium text-muted-foreground hover:text-foreground no-underline"
            >
              ← Painel
            </Link>
            <h1 className="text-[18px] font-black text-foreground m-0 flex-1">Histórico de lotes</h1>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-5 py-5 space-y-4">
          <p className="text-xs text-muted-foreground m-0 leading-relaxed">
            Lotes salvos no modo varejista. Toque em compartilhar para exportar CSV (WhatsApp, e-mail, Drive).
          </p>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : lotes.length === 0 ? (
            <div className="rounded-2xl border border-[#1E2A3A] bg-card/80 p-8 text-center">
              <p className="text-sm text-muted-foreground m-0">Nenhum lote salvo ainda.</p>
              <Link
                href="/parceiros/painel"
                className="inline-block mt-4 text-sm font-bold text-primary no-underline hover:underline"
              >
                Voltar ao painel
              </Link>
            </div>
          ) : (
            lotes.map((lote) => (
              <article
                key={lote.id}
                className="rounded-2xl border border-[#1E2A3A] bg-gradient-to-br from-card to-[#0d1219] p-4 shadow-[0_8px_32px_rgba(0,0,0,0.35)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-primary uppercase tracking-wider m-0">
                      {formatLoteDate(lote.created_at)}
                    </p>
                    <h2 className="text-[15px] font-black text-foreground mt-1 m-0 truncate">
                      {lote.nome_lote || `Lote · ${lote.total_itens} itens`}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-2 m-0">
                      <span className="font-semibold text-foreground">{lote.total_itens}</span> itens ·{' '}
                      <span className="font-semibold text-amber-500 tabular-nums">{formatBRL(lote.valor_total)}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={sharingId === lote.id}
                    onClick={() => void handleShareLote(lote)}
                    className="shrink-0 flex items-center justify-center w-11 h-11 rounded-xl bg-primary/15 border border-primary/40 text-primary hover:bg-primary/25 active:scale-95 transition-all disabled:opacity-50"
                    aria-label="Compartilhar CSV"
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </>
  );
}
