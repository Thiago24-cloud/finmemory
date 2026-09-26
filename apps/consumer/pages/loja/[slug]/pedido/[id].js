import Head from 'next/head';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

function formatBrl(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Acompanhamento público do pedido — /loja/[slug]/pedido/[id]?code=FM-2481
 */
export default function PedidoAcompanharPage() {
  const router = useRouter();
  const slug = typeof router.query.slug === 'string' ? router.query.slug : null;
  const id = typeof router.query.id === 'string' ? router.query.id : null;
  const code = typeof router.query.code === 'string' ? router.query.code : null;

  const [order, setOrder] = useState(null);
  const [storeName, setStoreName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!slug || (!id && !code)) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (id) qs.set('id', id);
      if (code) qs.set('code', code);
      const res = await fetch(`/api/loja/${encodeURIComponent(slug)}/orders?${qs}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || 'Pedido não encontrado.');
        setOrder(null);
        return;
      }
      setOrder(json.order);
      setStoreName(json.store?.name || '');
      setError('');
    } catch {
      setError('Erro de rede.');
    } finally {
      setLoading(false);
    }
  }, [slug, id, code]);

  useEffect(() => {
    if (!router.isReady) return;
    void load();
    const t = setInterval(() => void load(), 15000);
    return () => clearInterval(t);
  }, [router.isReady, load]);

  return (
    <>
      <Head>
        <title>Pedido — FinMemory</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className="min-h-screen bg-[#f6f7f4] text-[#122012] px-4 py-10">
        <div className="max-w-md mx-auto">
          {loading && !order ? (
            <p className="text-sm text-center m-0">Carregando pedido…</p>
          ) : error ? (
            <p className="text-sm text-center text-red-700 m-0">{error}</p>
          ) : order ? (
            <div className="rounded-2xl border border-[#d5ddd5] bg-white p-5 space-y-4">
              <div>
                <p className="text-xs text-[#1a2e1a]/60 m-0">{storeName}</p>
                <h1 className="text-xl font-bold m-0 mt-1">Código {order.pickup_code}</h1>
                <p className="text-sm m-0 mt-2 font-semibold text-[#1a5c2e]">
                  {order.status_label}
                </p>
                <p className="text-xs text-[#1a2e1a]/60 m-0 mt-1">
                  {order.order_type === 'delivery' ? 'Entrega local' : 'Retirada no local'}
                </p>
              </div>
              <ul className="space-y-1 list-none p-0 m-0 text-sm">
                {(order.items || []).map((item, idx) => (
                  <li key={idx} className="flex justify-between">
                    <span>
                      {item.quantity}x {item.product_name_snapshot}
                    </span>
                    <span>{formatBrl(item.total_price)}</span>
                  </li>
                ))}
              </ul>
              <p className="text-base font-bold m-0">Total {formatBrl(order.total_amount)}</p>
              <p className="text-xs text-[#1a2e1a]/55 m-0">
                Sem pagamento online neste MVP. A loja confirma e avisa pelo WhatsApp.
              </p>
              <button
                type="button"
                onClick={() => void load()}
                className="w-full rounded-xl border border-[#d5ddd5] py-2.5 text-sm font-bold"
              >
                Atualizar status
              </button>
              {slug ? (
                <Link
                  href={`/loja/${encodeURIComponent(slug)}`}
                  className="block text-center text-sm font-semibold text-[#1a5c2e]"
                >
                  Voltar à loja
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
