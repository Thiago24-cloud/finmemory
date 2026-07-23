'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  CreditCard,
  Delete,
  Loader2,
  Smartphone,
  Undo2,
  WifiOff,
} from 'lucide-react';
import {
  clearDividirDraft,
  dominantFormaPagamento,
  enqueueCaixaSync,
  FORMA_LABEL,
  formatBrl,
  loadDividirDraft,
  mesaDraftKey,
  parseMoneyInput,
  remainingOf,
  roundMoney,
  saveDividirDraft,
  sumPagamentos,
} from '../../../lib/merchant/caixa/dividirContaOffline';
import { painelApi } from '../../../lib/merchant/painelApiPaths';

const QUICK_ADDS = [10, 20, 50];

function newPagamentoId() {
  return `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Tela de divisão de conta — offline-first, letras grandes, teclado no polegar.
 */
export function DividirContaMesa({
  lojaId,
  title = 'Mesa',
  total,
  pedidoIds,
  mesaId = null,
  onClose,
  onClosed,
}) {
  const totalSafe = roundMoney(Number(total) || 0);
  const draftKey = useMemo(
    () => mesaDraftKey({ lojaId, mesaId, pedidoIds }),
    [lojaId, mesaId, pedidoIds]
  );

  const [pagamentos, setPagamentos] = useState([]);
  const [digits, setDigits] = useState('');
  const [cardPick, setCardPick] = useState(false);
  const [splitN, setSplitN] = useState('');
  const [showSplit, setShowSplit] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [offlineQueued, setOfflineQueued] = useState(false);
  const [error, setError] = useState('');
  const [successFlash, setSuccessFlash] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = loadDividirDraft(draftKey);
    if (saved?.pagamentos?.length) setPagamentos(saved.pagamentos);
    setHydrated(true);
  }, [draftKey]);

  useEffect(() => {
    if (!hydrated) return;
    saveDividirDraft(draftKey, {
      total: totalSafe,
      pedidoIds,
      mesaId,
      pagamentos,
    });
  }, [hydrated, draftKey, totalSafe, pedidoIds, mesaId, pagamentos]);

  const pago = sumPagamentos(pagamentos);
  const falta = remainingOf(totalSafe, pagamentos);
  const quitada = falta <= 0.009 && pagamentos.length > 0;
  const valorAtual = parseMoneyInput(digits);

  const appendDigit = (d) => {
    if (digits.replace(/\D/g, '').length >= 8) return;
    setDigits((prev) => `${prev}${d}`);
  };

  const backspace = () => setDigits((prev) => prev.slice(0, -1));

  const addQuick = (n) => {
    setDigits(String(roundMoney(valorAtual + n)));
  };

  const applySplitEqual = () => {
    const n = Math.floor(Number(splitN));
    if (!Number.isFinite(n) || n < 2 || n > 30) {
      setError('Informe de 2 a 30 pessoas.');
      return;
    }
    const share = roundMoney(falta / n);
    setDigits(String(share));
    setShowSplit(false);
    setSplitN('');
    setError('');
  };

  const registerPayment = (forma) => {
    setError('');
    setCardPick(false);
    if (quitada) return;
    const valor = valorAtual;
    if (!(valor > 0)) {
      setError('Digite o valor que o cliente está pagando.');
      return;
    }
    if (valor > falta + 0.009) {
      setError(`Valor maior que o restante (${formatBrl(falta)}).`);
      return;
    }
    setPagamentos((prev) => [
      ...prev,
      {
        id: newPagamentoId(),
        valor: roundMoney(valor),
        forma,
        at: new Date().toISOString(),
      },
    ]);
    setDigits('');
  };

  const undoPayment = (id) => {
    setPagamentos((prev) => prev.filter((p) => p.id !== id));
    setSuccessFlash(false);
    setOfflineQueued(false);
    setError('');
  };

  const syncClose = async () => {
    if (!quitada || syncing) return;
    setSyncing(true);
    setError('');
    const payload = {
      pedido_ids: pedidoIds,
      mesa_id: mesaId,
      forma_pagamento: dominantFormaPagamento(pagamentos),
      pagamentos: pagamentos.map((p) => ({
        valor: p.valor,
        forma: p.forma,
        at: p.at,
      })),
      valor_total: totalSafe,
      valor_pago: pago,
    };

    try {
      const online = typeof navigator === 'undefined' || navigator.onLine !== false;
      if (!online) throw new Error('offline');

      const res = await fetch(painelApi.caixaPagar, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Falha ao sincronizar.');

      clearDividirDraft(draftKey);
      setSuccessFlash(true);
      window.setTimeout(() => {
        onClosed?.({ offline: false, ...payload });
      }, 900);
    } catch {
      enqueueCaixaSync(payload);
      clearDividirDraft(draftKey);
      setOfflineQueued(true);
      setSuccessFlash(true);
      window.setTimeout(() => {
        onClosed?.({ offline: true, ...payload });
      }, 1200);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (quitada && !successFlash && !syncing) {
      void syncClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fecha ao zerar
  }, [quitada]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#0f1419] text-white">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 pt-[max(10px,env(safe-area-inset-top))] pb-2 border-b border-white/10">
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-full hover:bg-white/10 border-0 bg-transparent text-white cursor-pointer"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-white/50 m-0 uppercase tracking-wide">Dividir conta</p>
          <p className="font-bold text-sm m-0 truncate">{title}</p>
        </div>
        {typeof navigator !== 'undefined' && navigator.onLine === false ? (
          <span className="inline-flex items-center gap-1 text-[10px] text-amber-300 bg-amber-500/15 border border-amber-500/30 rounded-full px-2 py-1">
            <WifiOff className="h-3 w-3" /> Offline
          </span>
        ) : null}
      </div>

      {/* BLOCO 1 — Painel */}
      <div className="px-4 pt-4 pb-3 shrink-0">
        <p className="text-center text-white/55 text-sm m-0 mb-1">VALOR TOTAL</p>
        <p className="text-center text-3xl sm:text-4xl font-black tracking-tight m-0 text-white/90">
          {formatBrl(totalSafe)}
        </p>
        <div
          className={`mt-4 rounded-2xl px-4 py-5 text-center transition-colors duration-300 ${
            quitada
              ? 'bg-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.45)] animate-pulse'
              : 'bg-red-600 shadow-[0_8px_28px_rgba(220,38,38,0.35)]'
          }`}
        >
          <p className="text-xs font-bold uppercase tracking-widest m-0 opacity-90">
            {quitada ? 'Conta quitada!' : 'Falta pagar'}
          </p>
          <p className="text-4xl sm:text-5xl font-black m-0 mt-1 tabular-nums leading-none">
            {formatBrl(falta)}
          </p>
          {quitada ? (
            <p className="text-sm font-semibold m-0 mt-2 flex items-center justify-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              {offlineQueued
                ? 'Mesa fechada · sync quando a internet voltar'
                : syncing
                  ? 'Fechando mesa…'
                  : 'Mesa fechada com sucesso!'}
            </p>
          ) : (
            <p className="text-xs m-0 mt-2 opacity-80">
              Recebido {formatBrl(pago)} · {pagamentos.length} pagamento(s)
            </p>
          )}
        </div>
      </div>

      {/* BLOCO 2 — Histórico */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-white/40 m-0 mb-2">
          Pagamentos recebidos
        </p>
        {pagamentos.length === 0 ? (
          <p className="text-sm text-white/40 m-0 py-6 text-center">
            Ainda ninguém pagou. Digite o valor e escolha a forma.
          </p>
        ) : (
          <ul className="space-y-2 list-none p-0 m-0">
            {pagamentos.map((p, idx) => (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-3"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white shrink-0">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm m-0">
                    Pagamento {idx + 1}: {formatBrl(p.valor)}
                  </p>
                  <p className="text-xs text-white/55 m-0">
                    {FORMA_LABEL[p.forma] || p.forma}
                  </p>
                </div>
                {!quitada ? (
                  <button
                    type="button"
                    onClick={() => undoPayment(p.id)}
                    className="inline-flex items-center gap-1 rounded-full border border-white/20 px-2.5 py-1.5 text-[11px] font-semibold text-white/80 hover:bg-white/10 bg-transparent cursor-pointer"
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                    Desfazer
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {error ? (
          <p className="mt-3 text-sm text-red-300 bg-red-500/15 border border-red-500/30 rounded-xl px-3 py-2 m-0">
            {error}
          </p>
        ) : null}
      </div>

      {/* BLOCO 3 — Teclado + formas */}
      {!quitada ? (
        <div className="shrink-0 border-t border-white/10 bg-[#151b22] px-3 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          <div className="rounded-xl border border-white/15 bg-black/30 px-4 py-3 mb-2 text-right">
            <p className="text-[10px] text-white/40 m-0 uppercase">Valor deste pagamento</p>
            <p className="text-3xl font-black tabular-nums m-0 text-[#39FF14]">
              {digits ? formatBrl(valorAtual) : 'R$ 0,00'}
            </p>
          </div>

          <div className="grid grid-cols-4 gap-1.5 mb-2">
            {QUICK_ADDS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => addQuick(n)}
                className="rounded-xl border border-white/15 bg-white/5 py-2.5 text-xs font-bold text-white hover:bg-white/10 cursor-pointer"
              >
                + R$ {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setShowSplit(true);
                setError('');
              }}
              className="rounded-xl border border-amber-500/40 bg-amber-500/10 py-2.5 text-[10px] font-bold text-amber-200 hover:bg-amber-500/20 cursor-pointer leading-tight"
            >
              Rachar
              <br />
              por igual
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1.5 mb-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫'].map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  if (key === '⌫') backspace();
                  else if (key === ',') {
                    if (!digits.includes(',') && !digits.includes('.')) {
                      setDigits((p) => (p ? `${p},` : '0,'));
                    }
                  } else appendDigit(key);
                }}
                className="h-12 rounded-xl border border-white/10 bg-white/5 text-xl font-bold text-white active:bg-white/15 cursor-pointer flex items-center justify-center"
              >
                {key === '⌫' ? <Delete className="h-5 w-5" /> : key}
              </button>
            ))}
          </div>

          {cardPick ? (
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                type="button"
                onClick={() => registerPayment('debito')}
                className="h-14 rounded-2xl bg-blue-600 font-bold text-sm cursor-pointer border-0 text-white"
              >
                Débito
              </button>
              <button
                type="button"
                onClick={() => registerPayment('credito')}
                className="h-14 rounded-2xl bg-violet-600 font-bold text-sm cursor-pointer border-0 text-white"
              >
                Crédito
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setCardPick(true)}
                className="h-14 rounded-2xl bg-[#2563eb] font-bold text-xs sm:text-sm flex flex-col items-center justify-center gap-0.5 cursor-pointer border-0 text-white"
              >
                <CreditCard className="h-5 w-5" />
                CARTÃO
              </button>
              <button
                type="button"
                onClick={() => registerPayment('pix')}
                className="h-14 rounded-2xl bg-teal-600 font-bold text-xs sm:text-sm flex flex-col items-center justify-center gap-0.5 cursor-pointer border-0 text-white"
              >
                <Smartphone className="h-5 w-5" />
                PIX
              </button>
              <button
                type="button"
                onClick={() => registerPayment('dinheiro')}
                className="h-14 rounded-2xl bg-emerald-600 font-bold text-xs sm:text-sm flex flex-col items-center justify-center gap-0.5 cursor-pointer border-0 text-white"
              >
                <Banknote className="h-5 w-5" />
                DINHEIRO
              </button>
            </div>
          )}
          {cardPick ? (
            <button
              type="button"
              onClick={() => setCardPick(false)}
              className="w-full mt-2 text-xs text-white/50 underline bg-transparent border-0 cursor-pointer"
            >
              Voltar
            </button>
          ) : null}
        </div>
      ) : (
        <div className="shrink-0 border-t border-white/10 px-4 py-6 flex justify-center">
          {syncing ? <Loader2 className="h-8 w-8 animate-spin text-emerald-400" /> : null}
        </div>
      )}

      {showSplit ? (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Fechar"
            onClick={() => setShowSplit(false)}
          />
          <div className="relative w-full max-w-sm rounded-t-3xl sm:rounded-3xl bg-[#1a222c] border border-white/10 p-5 z-10">
            <p className="font-bold text-lg m-0 mb-1">Rachar por igual</p>
            <p className="text-sm text-white/55 m-0 mb-4">
              Quanto falta: <strong className="text-white">{formatBrl(falta)}</strong>
            </p>
            <label className="block text-xs text-white/50 mb-1">Número de pessoas</label>
            <input
              type="number"
              min={2}
              max={30}
              inputMode="numeric"
              value={splitN}
              onChange={(e) => setSplitN(e.target.value)}
              className="w-full h-12 rounded-xl border border-white/20 bg-black/30 px-3 text-lg font-bold text-white mb-4 outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Ex: 4"
            />
            <button
              type="button"
              onClick={applySplitEqual}
              className="w-full h-12 rounded-xl bg-emerald-500 text-[#0a0e14] font-bold border-0 cursor-pointer"
            >
              Preencher valor
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
