'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Clock, MapPin, MessageCircle, Minus, Plus, ShoppingBag, Store } from 'lucide-react';
import { whatsappMeUrl } from '../../lib/loja/publicStore';

function formatBrl(value) {
  return `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`;
}

async function postEvent(slug, eventType, meta = {}) {
  try {
    await fetch(`/api/loja/${encodeURIComponent(slug)}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: eventType, meta }),
    });
  } catch {
    /* ignore */
  }
}

/**
 * Página pública da loja com cardápio + carrinho de pedido direto.
 */
export function PublicStorePage({ slug, src = null }) {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [locked, setLocked] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [notes, setNotes] = useState('');
  const [orderType, setOrderType] = useState('pickup');
  const [regMsg, setRegMsg] = useState('');
  const [regErr, setRegErr] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [orderErr, setOrderErr] = useState('');
  const [orderLoading, setOrderLoading] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      setLocked(null);
      try {
        const res = await fetch(`/api/loja/${encodeURIComponent(slug)}`);
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.status === 403 && json.code === 'FEATURE_LOCKED') {
          setLocked(json);
          return;
        }
        if (!res.ok) {
          setError(json.error || 'Loja indisponível.');
          return;
        }
        setData(json);
      } catch {
        if (!cancelled) setError('Erro de rede.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!data?.store?.slug) return;
    const s = data.store.slug;
    void postEvent(s, 'public_page_viewed', { src: src || 'link' });
    if (src === 'qr') void postEvent(s, 'qr_code_scanned', { src: 'qr' });
  }, [data?.store?.slug, src]);

  useEffect(() => {
    if (!data?.features) return;
    if (data.features.pickup_orders) setOrderType('pickup');
    else if (data.features.local_delivery) setOrderType('delivery');
  }, [data?.features]);

  const waUrl = useMemo(() => {
    const phone = data?.store?.phone;
    if (!phone) return null;
    return whatsappMeUrl(
      phone,
      `Olá! Vi a página da ${data.store.name} no FinMemory e gostaria de mais informações.`
    );
  }, [data]);

  const cartLines = useMemo(() => {
    const products = data?.products || [];
    return products
      .filter((p) => cart[p.id] > 0)
      .map((p) => ({
        product: p,
        qty: cart[p.id],
        subtotal: Number(p.price || 0) * cart[p.id],
      }));
  }, [data?.products, cart]);

  const cartTotal = useMemo(
    () => cartLines.reduce((sum, line) => sum + line.subtotal, 0),
    [cartLines]
  );
  const cartCount = useMemo(
    () => Object.values(cart).reduce((sum, qty) => sum + qty, 0),
    [cart]
  );

  const addItem = (id) => {
    setCart((prev) => ({ ...prev, [id]: Math.min(20, (prev[id] || 0) + 1) }));
  };
  const removeItem = (id) => {
    setCart((prev) => {
      const next = { ...prev };
      const qty = (next[id] || 0) - 1;
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });
  };

  const onRegister = useCallback(
    async (e) => {
      e.preventDefault();
      if (!slug) return;
      setRegLoading(true);
      setRegErr('');
      setRegMsg('');
      try {
        const res = await fetch(`/api/loja/${encodeURIComponent(slug)}/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, whatsapp }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setRegErr(json.error || 'Não foi possível cadastrar.');
          return;
        }
        setRegMsg(json.linked_existing ? 'Dados atualizados.' : 'Cadastro feito!');
      } catch {
        setRegErr('Erro de rede.');
      } finally {
        setRegLoading(false);
      }
    },
    [slug, name, whatsapp]
  );

  const onSubmitOrder = useCallback(async () => {
    if (!slug || cartLines.length === 0) return;
    setOrderLoading(true);
    setOrderErr('');
    try {
      const res = await fetch(`/api/loja/${encodeURIComponent(slug)}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: name,
          customer_phone: whatsapp,
          order_type: orderType,
          notes,
          source: src === 'qr' ? 'qr_code' : 'public_page',
          items: cartLines.map((l) => ({
            product_id: l.product.id,
            quantity: l.qty,
          })),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setOrderErr(json.error || 'Não foi possível criar o pedido.');
        return;
      }
      const track = json.track_path || `/loja/${slug}/pedido/${json.order?.id}?code=${json.pickup_code}`;
      setCart({});
      setCheckoutOpen(false);
      void router.push(track);
    } catch {
      setOrderErr('Erro de rede.');
    } finally {
      setOrderLoading(false);
    }
  }, [slug, cartLines, name, whatsapp, orderType, notes, src, router]);

  const onWhatsapp = useCallback(async () => {
    if (!data?.store?.slug || !waUrl) return;
    await postEvent(data.store.slug, 'whatsapp_clicked', { src: src || 'link' });
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  }, [data, waUrl, src]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f7f4]">
        <p className="text-sm m-0 text-[#1a2e1a]/80">Carregando loja…</p>
      </div>
    );
  }

  if (locked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f7f4] px-4">
        <div className="max-w-md w-full rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <h1 className="text-lg font-bold text-amber-950 m-0 mb-2">Página indisponível</h1>
          <p className="text-sm text-amber-900 m-0">
            {locked.error ||
              `Essa funcionalidade está disponível no plano ${locked.required_plan_name || 'superior'}.`}
          </p>
        </div>
      </div>
    );
  }

  if (error || !data?.store) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f7f4] px-4">
        <p className="text-sm text-[#1a2e1a]/70 m-0">{error || 'Loja não encontrada.'}</p>
      </div>
    );
  }

  const { store, features, products, locked_digital_menu: lockedMenu } = data;

  return (
    <div className="min-h-screen bg-[#f6f7f4] text-[#122012] pb-24">
      <header className="bg-gradient-to-br from-[#1a5c2e] to-[#0d3d1c] text-white px-4 pt-10 pb-8">
        <div className="max-w-lg mx-auto">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 shrink-0">
              <Store className="h-6 w-6" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-white/70 m-0 mb-1">FinMemory</p>
              <h1 className="text-2xl font-bold m-0 leading-tight">{store.name}</h1>
            </div>
          </div>
          {store.address ? (
            <p className="mt-4 mb-0 text-sm text-white/85 flex items-start gap-2">
              <MapPin className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
              <span>{store.address}</span>
            </p>
          ) : null}
          {store.weekday_hours ? (
            <p className="mt-2 mb-0 text-sm text-white/85 flex items-start gap-2">
              <Clock className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
              <span>{store.weekday_hours}</span>
            </p>
          ) : null}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-wrap gap-2">
          {waUrl ? (
            <button
              type="button"
              onClick={onWhatsapp}
              className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white"
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              WhatsApp
            </button>
          ) : null}
          {features.direct_orders ? (
            <button
              type="button"
              onClick={() => setCheckoutOpen(true)}
              disabled={cartCount === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-[#1a5c2e] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              <ShoppingBag className="h-4 w-4" aria-hidden />
              Pedir ({cartCount})
            </button>
          ) : null}
        </div>

        <section>
          <h2 className="text-base font-bold m-0 mb-3">Cardápio</h2>
          {lockedMenu ? (
            <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 m-0">
              {lockedMenu.message}
            </p>
          ) : null}
          {features.digital_menu && products.length === 0 ? (
            <p className="text-sm text-[#1a2e1a]/60 m-0">Nenhum produto disponível.</p>
          ) : null}
          {features.digital_menu && products.length > 0 ? (
            <ul className="space-y-3 list-none p-0 m-0">
              {products.map((p) => (
                <li
                  key={p.id}
                  className="flex gap-3 rounded-xl border border-[#d5ddd5] bg-white p-3"
                >
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image_url}
                      alt=""
                      className="h-16 w-16 rounded-lg object-cover shrink-0 bg-[#eef2ee]"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-lg bg-[#eef2ee] shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold m-0">{p.name}</p>
                    <p className="text-sm font-semibold text-[#1a5c2e] m-0 mt-1">
                      {formatBrl(p.price)}
                    </p>
                    {features.direct_orders ? (
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => removeItem(p.id)}
                          className="h-8 w-8 rounded-lg border border-[#d5ddd5] flex items-center justify-center"
                          aria-label="Remover"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="text-sm font-bold w-6 text-center">{cart[p.id] || 0}</span>
                        <button
                          type="button"
                          onClick={() => addItem(p.id)}
                          className="h-8 w-8 rounded-lg bg-[#1a5c2e] text-white flex items-center justify-center"
                          aria-label="Adicionar"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        {features.customer_registration ? (
          <section className="rounded-2xl border border-[#d5ddd5] bg-white p-4">
            <h2 className="text-base font-bold m-0 mb-1">Cadastro rápido</h2>
            <p className="text-xs text-[#1a2e1a]/60 m-0 mb-3">Nome e WhatsApp — sem senha.</p>
            <form onSubmit={onRegister} className="space-y-3">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Seu nome"
                className="w-full rounded-lg border border-[#d5ddd5] px-3 py-2 text-sm"
              />
              <input
                type="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                required
                placeholder="WhatsApp com DDD"
                className="w-full rounded-lg border border-[#d5ddd5] px-3 py-2 text-sm"
              />
              {regErr ? <p className="text-xs text-red-700 m-0">{regErr}</p> : null}
              {regMsg ? <p className="text-xs text-[#1a5c2e] m-0">{regMsg}</p> : null}
              <button
                type="submit"
                disabled={regLoading}
                className="w-full rounded-xl bg-[#122012] text-white text-sm font-bold py-2.5 disabled:opacity-60"
              >
                {regLoading ? 'Salvando…' : 'Cadastrar'}
              </button>
            </form>
          </section>
        ) : null}

        <p className="text-center text-[11px] text-[#1a2e1a]/45 m-0">
          Powered by{' '}
          <Link href="/" className="underline font-medium text-[#1a5c2e]">
            FinMemory
          </Link>
        </p>
      </main>

      {features.direct_orders && cartCount > 0 ? (
        <div className="fixed bottom-0 inset-x-0 p-3 bg-white/95 border-t border-[#d5ddd5]">
          <div className="max-w-lg mx-auto">
            <button
              type="button"
              onClick={() => setCheckoutOpen(true)}
              className="w-full rounded-xl bg-[#1a5c2e] text-white font-bold py-3 text-sm"
            >
              Ver pedido · {formatBrl(cartTotal)}
            </button>
          </div>
        </div>
      ) : null}

      {checkoutOpen ? (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold m-0">Seu pedido</h2>
              <button type="button" className="text-sm font-semibold" onClick={() => setCheckoutOpen(false)}>
                Fechar
              </button>
            </div>
            <ul className="space-y-2 list-none p-0 m-0 mb-4">
              {cartLines.map((l) => (
                <li key={l.product.id} className="flex justify-between text-sm">
                  <span>
                    {l.qty}x {l.product.name}
                  </span>
                  <span className="font-semibold">{formatBrl(l.subtotal)}</span>
                </li>
              ))}
            </ul>
            <p className="text-base font-bold m-0 mb-4">Total {formatBrl(cartTotal)}</p>

            {(features.pickup_orders || features.local_delivery) && (
              <div className="flex gap-2 mb-4">
                {features.pickup_orders ? (
                  <button
                    type="button"
                    onClick={() => setOrderType('pickup')}
                    className={`flex-1 rounded-lg py-2 text-xs font-bold border ${
                      orderType === 'pickup'
                        ? 'bg-[#1a5c2e] text-white border-[#1a5c2e]'
                        : 'border-[#d5ddd5]'
                    }`}
                  >
                    Retirada no local
                  </button>
                ) : null}
                {features.local_delivery ? (
                  <button
                    type="button"
                    onClick={() => setOrderType('delivery')}
                    className={`flex-1 rounded-lg py-2 text-xs font-bold border ${
                      orderType === 'delivery'
                        ? 'bg-[#1a5c2e] text-white border-[#1a5c2e]'
                        : 'border-[#d5ddd5]'
                    }`}
                  >
                    Entrega local
                  </button>
                ) : null}
              </div>
            )}

            <div className="space-y-3 mb-4">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                className="w-full rounded-lg border border-[#d5ddd5] px-3 py-2 text-sm"
              />
              <input
                type="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="WhatsApp com DDD"
                className="w-full rounded-lg border border-[#d5ddd5] px-3 py-2 text-sm"
              />
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observações (opcional)"
                rows={2}
                className="w-full rounded-lg border border-[#d5ddd5] px-3 py-2 text-sm"
              />
            </div>
            {orderErr ? <p className="text-xs text-red-700 m-0 mb-3">{orderErr}</p> : null}
            <button
              type="button"
              disabled={orderLoading || !name.trim() || !whatsapp.trim()}
              onClick={() => void onSubmitOrder()}
              className="w-full rounded-xl bg-[#1a5c2e] text-white font-bold py-3 text-sm disabled:opacity-50"
            >
              {orderLoading ? 'Enviando…' : 'Confirmar pedido (sem pagamento online)'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
