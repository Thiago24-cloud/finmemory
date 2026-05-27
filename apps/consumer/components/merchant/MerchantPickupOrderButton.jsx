'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { Loader2, ShoppingBag } from 'lucide-react';
import { PEDIDOS_API, PEDIDOS_CHECKOUT_API, pedidoTrackApi } from '../../lib/merchant/painelApiPaths';

/**
 * Botão "Pedir retirada" para ofertas merchant-pl-{produto_loja_id}.
 * @param {{ lojaId: string, produtoLojaId: string, productName?: string, price?: number, storeName?: string }} props
 */
export function MerchantPickupOrderButton({ lojaId, produtoLojaId, productName, price, storeName }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const onOrder = async () => {
    if (status !== 'authenticated') {
      router.push(`/login?callbackUrl=${encodeURIComponent('/mapa')}`);
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const payload = {
        loja_id: lojaId,
        items: [{ produto_loja_id: produtoLojaId, quantidade: 1 }],
      };

      let res = await fetch(PEDIDOS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      let data = await res.json().catch(() => ({}));

      if (res.status === 402 && data.code === 'PAYMENT_REQUIRED') {
        res = await fetch(PEDIDOS_CHECKOUT_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        data = await res.json().catch(() => ({}));
        if (res.ok && data.url) {
          window.location.href = data.url;
          return;
        }
      }

      if (!res.ok) {
        setMsg(data.error || 'Não foi possível enviar o pedido.');
        return;
      }

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      const orderId = data.order?.id || data.pedido_id;
      setMsg(
        orderId
          ? `Pedido enviado! ETA ~${data.order?.eta_minutos_restantes ?? data.order?.tempo_preparo_minutos ?? 15} min.`
          : data.message || 'Pedido enviado!'
      );
      if (orderId) {
        setTimeout(() => {
          void router.push(`/pedido/${orderId}`);
        }, 1200);
      }
    } catch {
      setMsg('Erro de rede.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 space-y-2">
      <button
        type="button"
        disabled={busy}
        onClick={onOrder}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#39FF14] px-4 py-2.5 text-sm font-bold text-[#050508] hover:brightness-110 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ShoppingBag className="h-4 w-4" aria-hidden />}
        Pagar e pedir retirada
        {price != null ? ` · R$ ${Number(price).toFixed(2).replace('.', ',')}` : ''}
      </button>
      {productName ? (
        <p className="text-[10px] text-white/45 m-0 text-center">
          {storeName ? `${storeName} · ` : ''}
          {productName}
        </p>
      ) : null}
      {msg ? (
        <p className={`text-xs m-0 text-center ${msg.includes('enviado') ? 'text-[#39FF14]' : 'text-red-400'}`}>{msg}</p>
      ) : null}
    </div>
  );
}

/** @param {string} offerId */
export function parseMerchantPlOffer(offerId) {
  const s = String(offerId || '');
  if (!s.startsWith('merchant-pl-')) return null;
  const produtoLojaId = s.slice('merchant-pl-'.length);
  if (!produtoLojaId || produtoLojaId.length < 8) return null;
  return { produtoLojaId };
}
