'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  DollarSign,
  Loader2,
  Receipt,
  Smartphone,
  Utensils,
  X,
} from 'lucide-react';
import { painelApi } from '../../../lib/merchant/painelApiPaths';
import { usePedidosLojaRealtime } from '../../../hooks/usePedidosLojaRealtime';
import { SkipPageHeader } from '../skip/SkipPageHeader';
import { SkipCard, SkipCardContent } from '../skip/SkipCard';
import { SkipButton } from '../skip/SkipButton';

function formatBrl(v) {
  return `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;
}

const FORMAS_PAGAMENTO = [
  { id: 'debito', label: 'Débito', Icon: CreditCard, hint: 'Cartão na maquininha' },
  { id: 'credito', label: 'Crédito', Icon: CreditCard, hint: 'Cartão na maquininha' },
  { id: 'pix', label: 'Pix', Icon: Smartphone, hint: 'Transferência Pix' },
  { id: 'dinheiro', label: 'Dinheiro', Icon: Banknote, hint: 'Pagamento em espécie' },
];

export function MerchantCaixaSection({ lojaId }) {
  const [orders, setOrders] = useState([]);
  const [mesas, setMesas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMesa, setSelectedMesa] = useState(null);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [payError, setPayError] = useState('');
  const [cancelId, setCancelId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ordRes, mesaRes] = await Promise.all([
        fetch(`${painelApi.pedidos}?scope=caixa&limit=100`),
        fetch(painelApi.mesas),
      ]);
      const ordJson = await ordRes.json().catch(() => ({}));
      const mesaJson = await mesaRes.json().catch(() => ({}));
      if (ordRes.ok) setOrders(ordJson.orders || []);
      if (mesaRes.ok) setMesas(mesaJson.mesas || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  usePedidosLojaRealtime(lojaId, load);

  const tableData = useMemo(() => {
    const mesaNums = new Set(mesas.map((m) => m.numero));
    for (const o of orders) {
      if (o.mesa_numero != null) mesaNums.add(o.mesa_numero);
    }
    return [...mesaNums]
      .sort((a, b) => a - b)
      .map((numero) => {
        const mesaOrders = orders.filter((o) => o.mesa_numero === numero);
        const total = mesaOrders.reduce((s, o) => s + Number(o.total || 0), 0);
        const mesa = mesas.find((m) => m.numero === numero);
        return { numero, mesa, orders: mesaOrders, total, active: mesaOrders.length > 0 };
      });
  }, [mesas, orders]);

  const balcaoOrders = orders.filter((o) => o.mesa_numero == null);
  const allTables = useMemo(() => {
    const rows = [...tableData];
    if (balcaoOrders.length) {
      rows.unshift({
        numero: -1,
        mesa: null,
        orders: balcaoOrders,
        total: balcaoOrders.reduce((s, o) => s + Number(o.total || 0), 0),
        active: true,
      });
    }
    return rows;
  }, [tableData, balcaoOrders]);

  const selected = allTables.find((t) =>
    selectedMesa === 'balcao' ? t.numero === -1 : t.numero === selectedMesa
  );

  const openFinalizar = () => {
    if (!selected?.orders?.length) return;
    setPayError('');
    setPayModalOpen(true);
  };

  const closePayModal = () => {
    if (busy) return;
    setPayModalOpen(false);
    setPayError('');
  };

  const pagarComForma = async (formaPagamento) => {
    if (!selected?.orders?.length || !formaPagamento) return;
    setBusy(true);
    setPayError('');
    try {
      const res = await fetch(painelApi.caixaPagar, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pedido_ids: selected.orders.map((o) => o.id),
          mesa_id: selected.mesa?.id || null,
          forma_pagamento: formaPagamento,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPayError(data.error || 'Não foi possível finalizar o pedido.');
        return;
      }
      setPayModalOpen(false);
      setSelectedMesa(null);
      await load();
    } catch {
      setPayError('Erro de rede ao finalizar.');
    } finally {
      setBusy(false);
    }
  };

  const cancelOrder = async (id, mode) => {
    setBusy(true);
    try {
      await fetch(painelApi.pedido(id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: mode }),
      });
      setCancelId(null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="animate-fade-in-up">
      <SkipPageHeader
        icon={Receipt}
        title="Caixa"
        description="Some o pedido, cobre na maquininha e finalize no app."
      />

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : allTables.filter((t) => t.active).length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="m-0 text-sm">Nenhuma conta aberta.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {allTables.filter((t) => t.active).map((t) => (
            <button
              key={t.numero}
              type="button"
              onClick={() => setSelectedMesa(t.numero === -1 ? 'balcao' : t.numero)}
              className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-center hover:bg-primary/10 transition-colors shadow-subtle"
            >
              <Utensils className="h-6 w-6 mx-auto text-primary mb-2" />
              <p className="font-bold m-0">{t.numero === -1 ? 'Balcão' : `Mesa ${t.numero}`}</p>
              <p className="text-lg font-black text-primary mt-2 m-0">{formatBrl(t.total)}</p>
            </button>
          ))}
        </div>
      )}

      {selected ? (
        <div className="fixed inset-0 z-40 flex flex-col justify-end sm:justify-center sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Fechar"
            onClick={() => !busy && !payModalOpen && setSelectedMesa(null)}
          />
          <SkipCard className="relative w-full max-w-md max-h-[85vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl shadow-lg z-10">
            <SkipCardContent className="p-5">
              <h3 className="text-lg font-bold m-0 mb-4">
                {selected.numero === -1 ? 'Balcão' : `Mesa ${selected.numero}`}
              </h3>
              <div className="space-y-3 mb-4">
                {selected.orders.map((order) => (
                  <div key={order.id} className="rounded-xl border border-border p-3">
                    <div className="flex justify-between mb-2">
                      <span className="text-xs text-muted-foreground">{order.status}</span>
                      <span className="font-bold text-primary">{formatBrl(order.total)}</span>
                    </div>
                    {(order.itens || []).map((item, i) => (
                      <p key={i} className="text-sm m-0">
                        {item.quantidade}× {item.nome}
                      </p>
                    ))}
                    <button
                      type="button"
                      onClick={() => setCancelId(order.id)}
                      className="mt-2 text-xs text-destructive underline bg-transparent border-0 cursor-pointer p-0"
                    >
                      Cancelar / estornar
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center mb-2 pt-3 border-t border-border">
                <span className="text-muted-foreground">Total</span>
                <span className="text-2xl font-black text-primary">{formatBrl(selected.total)}</span>
              </div>
              <p className="text-xs text-muted-foreground m-0 mb-4">
                Passe <strong>{formatBrl(selected.total)}</strong> na maquininha física. Quando aprovar,
                toque em Finalizar Pedido e informe como o cliente pagou.
              </p>
              <SkipButton
                disabled={busy}
                onClick={openFinalizar}
                className="w-full h-12 rounded-xl text-base font-bold"
              >
                <DollarSign className="h-5 w-5" />
                Finalizar Pedido
              </SkipButton>
            </SkipCardContent>
          </SkipCard>
        </div>
      ) : null}

      {payModalOpen && selected ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Fechar"
            onClick={closePayModal}
          />
          <SkipCard className="relative w-full max-w-sm rounded-t-3xl sm:rounded-3xl shadow-lg z-10">
            <SkipCardContent className="p-5">
              <div className="flex items-start justify-between gap-3 mb-1">
                <div>
                  <p className="font-bold text-lg m-0">Como o cliente pagou?</p>
                  <p className="text-sm text-muted-foreground m-0 mt-1">
                    Total cobrado: <strong className="text-foreground">{formatBrl(selected.total)}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closePayModal}
                  disabled={busy}
                  className="p-2 rounded-full text-muted-foreground hover:bg-muted border-0 bg-transparent cursor-pointer"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {payError ? (
                <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-xl px-3 py-2 my-3 m-0">
                  {payError}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground my-3 m-0">
                  A cobrança já foi feita na maquininha. Só registre a forma para fechar o pedido.
                </p>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                {FORMAS_PAGAMENTO.map(({ id, label, Icon, hint }) => (
                  <button
                    key={id}
                    type="button"
                    disabled={busy}
                    onClick={() => void pagarComForma(id)}
                    className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-card p-4 text-center hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {busy ? (
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    ) : (
                      <Icon className="h-6 w-6 text-primary" />
                    )}
                    <span className="font-bold text-sm">{label}</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">{hint}</span>
                  </button>
                ))}
              </div>
            </SkipCardContent>
          </SkipCard>
        </div>
      ) : null}

      {cancelId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => !busy && setCancelId(null)}
          />
          <SkipCard className="relative max-w-sm w-full z-10">
            <SkipCardContent className="p-5">
              <p className="font-bold m-0 mb-2">Cancelar ou estornar?</p>
              <p className="text-sm text-muted-foreground m-0 mb-4">O estoque dos itens será restaurado.</p>
              <div className="flex gap-2">
                <SkipButton
                  variant="outline"
                  onClick={() => void cancelOrder(cancelId, 'cancel')}
                  disabled={busy}
                  className="flex-1 text-destructive border-destructive/40"
                >
                  Cancelar
                </SkipButton>
                <SkipButton
                  variant="outline"
                  onClick={() => void cancelOrder(cancelId, 'refund')}
                  disabled={busy}
                  className="flex-1"
                >
                  Estornar
                </SkipButton>
              </div>
            </SkipCardContent>
          </SkipCard>
        </div>
      ) : null}
    </div>
  );
}
