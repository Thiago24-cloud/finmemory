import { useCallback, useEffect, useMemo, useState } from 'react';

const STATUS_LABELS = {
  pendente: 'Aguardando a cozinha',
  preparando: 'Preparando seu pedido',
  pronto: 'Pronto! Chame o garçom',
  concluido: 'Pedido entregue',
  cancelado: 'Pedido cancelado',
};

function formatBrl(value) {
  return `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`;
}

/**
 * Cardápio + carrinho + envio para cozinha (QR da mesa).
 */
export function PedirMesaClient({ lojaId, mesaNumero }) {
  const [products, setProducts] = useState([]);
  const [storeName, setStoreName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cart, setCart] = useState({});
  const [cartOpen, setCartOpen] = useState(false);
  const [observacao, setObservacao] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [placedOrder, setPlacedOrder] = useState(null);
  const [orderStatus, setOrderStatus] = useState(null);

  const mesaLabel = mesaNumero != null ? `Mesa ${mesaNumero}` : 'Balcão';
  const canOrder = lojaId && mesaNumero != null && Number.isFinite(mesaNumero);

  useEffect(() => {
    if (!lojaId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const qs = new URLSearchParams({ loja: lojaId });
        if (mesaNumero != null) qs.set('mesa', String(mesaNumero));
        const res = await fetch(`/api/parceiros/pedir/menu?${qs}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (!cancelled) setError(json.error || 'Cardápio indisponível.');
          return;
        }
        if (!cancelled) {
          setProducts(json.products || []);
          setStoreName(json.store?.name || 'Restaurante');
        }
      } catch {
        if (!cancelled) setError('Erro de rede.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lojaId, mesaNumero]);

  const cartLines = useMemo(() => {
    return products
      .filter((p) => cart[p.id] > 0)
      .map((p) => ({
        product: p,
        qty: cart[p.id],
        subtotal: Number(p.price ?? p.preco_original ?? 0) * cart[p.id],
      }));
  }, [products, cart]);

  const cartTotal = useMemo(
    () => cartLines.reduce((sum, line) => sum + line.subtotal, 0),
    [cartLines]
  );

  const cartCount = useMemo(
    () => Object.values(cart).reduce((sum, qty) => sum + qty, 0),
    [cart]
  );

  const addItem = (productId) => {
    setCart((prev) => ({
      ...prev,
      [productId]: Math.min(20, (prev[productId] || 0) + 1),
    }));
  };

  const removeItem = (productId) => {
    setCart((prev) => {
      const next = { ...prev };
      const qty = (next[productId] || 0) - 1;
      if (qty <= 0) delete next[productId];
      else next[productId] = qty;
      return next;
    });
  };

  const pollOrderStatus = useCallback(async (orderId) => {
    if (!lojaId || !orderId) return;
    try {
      const qs = new URLSearchParams({ pedido: orderId, loja: lojaId });
      const res = await fetch(`/api/parceiros/pedir/status?${qs}`);
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.order) {
        setOrderStatus(json.order.status);
      }
    } catch {
      /* ignore */
    }
  }, [lojaId]);

  useEffect(() => {
    if (!placedOrder?.id) return;
    void pollOrderStatus(placedOrder.id);
    const interval = setInterval(() => {
      void pollOrderStatus(placedOrder.id);
    }, 5000);
    return () => clearInterval(interval);
  }, [placedOrder?.id, pollOrderStatus]);

  const submitOrder = async () => {
    if (!canOrder || cartLines.length === 0) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const items = cartLines.map((line) => ({
        produto_loja_id: line.product.id,
        quantidade: line.qty,
      }));
      const res = await fetch('/api/parceiros/pedir/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loja: lojaId,
          mesa: mesaNumero,
          items,
          observacao: observacao.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(json.error || 'Não foi possível enviar o pedido.');
        return;
      }
      setPlacedOrder(json.order);
      setOrderStatus(json.order?.status || 'pendente');
      setCart({});
      setCartOpen(false);
      setObservacao('');
    } catch {
      setSubmitError('Erro de rede ao enviar pedido.');
    } finally {
      setSubmitting(false);
    }
  };

  if (placedOrder) {
    const status = orderStatus || placedOrder.status;
    const statusLabel = STATUS_LABELS[status] || status;
    return (
      <div className="min-h-screen bg-[#050508] text-white px-4 py-8 max-w-lg mx-auto flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-full bg-[#39FF14]/15 border border-[#39FF14]/40 flex items-center justify-center mb-4">
          <span className="text-2xl">✓</span>
        </div>
        <h1 className="text-xl font-bold m-0">Pedido enviado!</h1>
        <p className="text-sm text-white/50 mt-2 m-0">
          {storeName} · {mesaLabel}
        </p>
        <p className="text-lg font-semibold text-[#39FF14] mt-4 m-0">{statusLabel}</p>
        <p className="text-xs text-white/40 mt-2 m-0">
          Total {formatBrl(placedOrder.total)}
        </p>
        {status === 'pronto' ? (
          <p className="text-sm text-white/70 mt-6 m-0 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
            Seu pedido está pronto. Chame o garçom para retirar na mesa.
          </p>
        ) : null}
        {status !== 'concluido' && status !== 'cancelado' ? (
          <p className="text-[10px] text-white/30 mt-8 m-0">Atualizando status automaticamente…</p>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setPlacedOrder(null);
            setOrderStatus(null);
          }}
          className="mt-8 text-sm text-[#39FF14] underline underline-offset-2"
        >
          Fazer outro pedido
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050508] text-white pb-28">
      <div className="px-4 py-6 max-w-lg mx-auto">
        <header className="mb-6">
          <p className="text-[10px] uppercase tracking-widest text-[#39FF14] font-bold m-0">FinMemory</p>
          <h1 className="text-xl font-bold m-0 mt-1">{storeName || 'Carregando…'}</h1>
          <p className="text-sm text-white/50 m-0 mt-1">{mesaLabel}</p>
        </header>

        {loading ? <p className="text-white/50 text-sm">Carregando cardápio…</p> : null}
        {error ? (
          <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
            {error}
          </p>
        ) : null}

        {!loading && !error ? (
          <ul className="space-y-3 list-none p-0 m-0">
            {products.map((p) => {
              const price = Number(p.price ?? p.preco_original ?? 0);
              const qty = cart[p.id] || 0;
              return (
                <li
                  key={p.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex gap-3"
                >
                  {p.url_imagem ? (
                    <img
                      src={p.url_imagem}
                      alt=""
                      className="w-16 h-16 rounded-xl object-cover shrink-0"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm m-0">{p.nome}</p>
                    {p.descricao ? (
                      <p className="text-xs text-white/45 mt-1 m-0 line-clamp-2">{p.descricao}</p>
                    ) : null}
                    <div className="flex items-center justify-between gap-2 mt-2">
                      <p className="text-[#39FF14] font-black m-0">{formatBrl(price)}</p>
                      {canOrder ? (
                        <div className="flex items-center gap-2 shrink-0">
                          {qty > 0 ? (
                            <>
                              <button
                                type="button"
                                onClick={() => removeItem(p.id)}
                                className="w-8 h-8 rounded-lg border border-white/20 text-white/80 text-lg leading-none"
                                aria-label="Remover"
                              >
                                −
                              </button>
                              <span className="text-sm font-bold w-5 text-center">{qty}</span>
                            </>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => addItem(p.id)}
                            className="w-8 h-8 rounded-lg bg-[#39FF14] text-[#050508] font-bold text-lg leading-none"
                            aria-label="Adicionar"
                          >
                            +
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}

        {!loading && !error && products.length === 0 ? (
          <p className="text-white/40 text-sm">Nenhum item disponível no cardápio.</p>
        ) : null}

        {!canOrder && !loading && !error ? (
          <p className="text-[10px] text-white/30 mt-8 text-center">
            Escaneie o QR da sua mesa para fazer pedidos.
          </p>
        ) : null}
      </div>

      {canOrder && cartCount > 0 ? (
        <>
          <div className="fixed bottom-0 inset-x-0 z-20 border-t border-white/10 bg-[#0a0a0f]/95 backdrop-blur px-4 py-3">
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="w-full max-w-lg mx-auto flex items-center justify-between rounded-2xl bg-[#39FF14] text-[#050508] px-5 py-3.5 font-bold"
            >
              <span>
                Ver carrinho ({cartCount})
              </span>
              <span>{formatBrl(cartTotal)}</span>
            </button>
          </div>

          {cartOpen ? (
            <div className="fixed inset-0 z-30 flex flex-col justify-end">
              <button
                type="button"
                className="absolute inset-0 bg-black/60"
                aria-label="Fechar"
                onClick={() => !submitting && setCartOpen(false)}
              />
              <div className="relative bg-[#0f0f14] rounded-t-3xl border-t border-white/10 px-4 pt-5 pb-8 max-h-[85vh] overflow-y-auto max-w-lg mx-auto w-full">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold m-0">Seu pedido</h2>
                  <button
                    type="button"
                    onClick={() => !submitting && setCartOpen(false)}
                    className="text-white/50 text-sm"
                  >
                    Fechar
                  </button>
                </div>

                <ul className="space-y-3 list-none p-0 m-0 mb-4">
                  {cartLines.map((line) => (
                    <li key={line.product.id} className="flex justify-between gap-2 text-sm">
                      <span className="text-white/90">
                        {line.qty}× {line.product.nome}
                      </span>
                      <span className="text-white/60 shrink-0">{formatBrl(line.subtotal)}</span>
                    </li>
                  ))}
                </ul>

                <label className="block text-xs text-white/50 mb-1">Observações (opcional)</label>
                <textarea
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  rows={2}
                  maxLength={200}
                  placeholder="Ex.: sem cebola, bem passado…"
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 resize-none mb-4"
                />

                {submitError ? (
                  <p className="text-red-400 text-xs mb-3 m-0">{submitError}</p>
                ) : null}

                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-white/60">Total</span>
                  <span className="text-lg font-black text-[#39FF14]">{formatBrl(cartTotal)}</span>
                </div>

                <button
                  type="button"
                  disabled={submitting || cartLines.length === 0}
                  onClick={() => void submitOrder()}
                  className="w-full rounded-2xl bg-[#39FF14] text-[#050508] py-3.5 font-bold disabled:opacity-50"
                >
                  {submitting ? 'Enviando…' : 'Enviar para a cozinha'}
                </button>
                <p className="text-[10px] text-white/35 text-center mt-3 m-0">
                  Pagamento na mesa com o garçom.
                </p>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
