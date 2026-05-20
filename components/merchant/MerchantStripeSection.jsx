'use client';

import { useCallback, useEffect, useState } from 'react';
import { CreditCard, ExternalLink, Loader2 } from 'lucide-react';
import { painelApi } from '../../lib/merchant/painelApiPaths';

export function MerchantStripeSection() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(painelApi.stripeStatus);
      const data = await res.json().catch(() => ({}));
      if (res.ok) setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const q = new URLSearchParams(window.location.search);
    if (q.get('stripe_connect') === 'done') {
      setMsg('Volte aqui após concluir o cadastro no Stripe. Atualizando status…');
      void load();
    }
  }, [load]);

  const openConnect = async () => {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch(painelApi.stripeConnect, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        setMsg(data.error || 'Não foi possível abrir o Stripe.');
        return;
      }
      window.location.href = data.url;
    } catch {
      setMsg('Erro de rede.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 mb-6 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#39FF14]" aria-label="Carregando pagamentos" />
      </section>
    );
  }

  if (!status?.enabled) return null;

  const ready = status.ready;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 mb-6">
      <h2 className="text-sm font-bold m-0 flex items-center gap-2">
        <CreditCard className="h-4 w-4 text-[#39FF14]" aria-hidden />
        Recebimentos (Stripe)
      </h2>
      <p className="text-xs text-white/50 mt-2 m-0">
        {ready
          ? 'Pagamentos online ativos. Clientes pagam no app e o valor cai na sua conta Stripe.'
          : 'Conecte sua conta para receber pedidos pagos pelo app (cartão via Stripe).'}
      </p>
      {status.platform_fee_percent > 0 ? (
        <p className="text-[10px] text-white/35 mt-1 m-0">
          Taxa FinMemory: {status.platform_fee_percent}% por pedido pago.
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span
          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border ${
            ready
              ? 'text-[#39FF14] border-[#39FF14]/40 bg-[#39FF14]/10'
              : 'text-amber-200 border-amber-500/40 bg-amber-500/10'
          }`}
        >
          {ready ? 'Ativo' : 'Pendente'}
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={() => void openConnect()}
          className="inline-flex items-center gap-2 rounded-xl border border-[#39FF14]/50 text-[#39FF14] px-4 py-2 text-xs font-bold hover:bg-[#39FF14]/10 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <ExternalLink className="h-3.5 w-3.5" aria-hidden />}
          {ready ? 'Atualizar dados Stripe' : 'Conectar Stripe'}
        </button>
      </div>
      {msg ? <p className="text-xs text-white/55 mt-3 m-0">{msg}</p> : null}
    </section>
  );
}
