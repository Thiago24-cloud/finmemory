import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Loader2, Clock, CheckCircle2 } from 'lucide-react';
import { pedidoTrackApi } from '../../lib/merchant/painelApiPaths';

const STATUS_PT = {
  pendente: 'Aguardando a loja',
  preparando: 'Em preparo',
  pronto: 'Pronto para retirada',
  concluido: 'Retirado',
  cancelado: 'Cancelado',
};

export default function PedidoTrackPage() {
  const router = useRouter();
  const { id } = router.query;
  const { status: authStatus } = useSession();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id || typeof id !== 'string') return;
    setLoading(true);
    try {
      const res = await fetch(pedidoTrackApi(id));
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Pedido não encontrado.');
        setOrder(null);
        return;
      }
      setOrder(data.order);
      setError('');
    } catch {
      setError('Erro de rede.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.replace(`/login?callbackUrl=${encodeURIComponent(`/pedido/${id}`)}`);
      return;
    }
    if (authStatus !== 'authenticated' || !id) return;
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [authStatus, id, load, router]);

  const done = order?.status === 'concluido' || order?.status === 'cancelado';

  return (
    <>
      <Head>
        <title>Acompanhar pedido — FinMemory</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className="min-h-screen bg-[#050508] text-white px-4 py-8 max-w-md mx-auto">
        <Link href="/mapa" className="text-sm text-[#39FF14] hover:underline">
          ← Voltar ao mapa
        </Link>
        <h1 className="text-xl font-bold mt-6 flex items-center gap-2">
          <Clock className="h-6 w-6 text-[#39FF14]" aria-hidden />
          Seu pedido
        </h1>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-[#39FF14]" />
          </div>
        ) : error ? (
          <p className="text-red-400 mt-6">{error}</p>
        ) : order ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
            {order.payment_status === 'pending' ? (
              <p className="text-sm text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 m-0">
                Aguardando confirmação do pagamento. Se você fechou o checkout, abra o link do e-mail do Stripe ou
                tente pedir de novo no mapa.
              </p>
            ) : null}
            <p className="text-lg font-semibold m-0">{STATUS_PT[order.status] || order.status}</p>
            {!done && order.eta_minutos_restantes != null ? (
              <p className="text-sm text-[#39FF14] m-0">
                Previsão: ~{order.eta_minutos_restantes} min
              </p>
            ) : null}
            {order.status === 'pronto' ? (
              <p className="text-sm text-[#39FF14] flex items-center gap-2 m-0">
                <CheckCircle2 className="h-5 w-5" /> Pode retirar na loja!
              </p>
            ) : null}
            <ul className="text-sm text-white/70 space-y-2 list-none p-0 m-0 border-t border-white/10 pt-4">
              {(order.itens || []).map((i) => (
                <li key={i.id} className="flex justify-between">
                  <span>
                    {i.quantidade}× {i.nome}
                  </span>
                  <span>R$ {Number(i.subtotal).toFixed(2).replace('.', ',')}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm font-bold m-0 pt-2 border-t border-white/10">
              Total R$ {Number(order.total).toFixed(2).replace('.', ',')}
            </p>
          </div>
        ) : null}
      </div>
    </>
  );
}
