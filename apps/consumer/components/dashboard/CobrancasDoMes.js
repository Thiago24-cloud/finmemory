'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  Check,
  ChevronDown,
  Loader2,
  MoreVertical,
  Plus,
  Trash2,
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/Sheet';
import { ExpressionValueField } from '../ui/ExpressionValueField';
import { SubscriptionBrandAvatar } from './SubscriptionBrandAvatar';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';

const SWIPE_PAY_THRESHOLD_PX = 72;

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toLocalISODate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function computeDueDateMensal(diaVencimento, year, monthIndex) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const day = Math.min(Math.max(1, Number(diaVencimento) || 1), lastDay);
  return toLocalISODate(new Date(year, monthIndex, day));
}

function parseValor(v) {
  let raw = (v || '').toString().trim();
  if (!raw) return null;
  raw = raw.replace(/\s/g, '').replace(/^R\$\s?/i, '');
  if (!raw) return null;
  const cleaned = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw.replace(/,/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function formatBRL(n) {
  const num = Number(n) || 0;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function ensureMonthKey(selectedMonth) {
  if (selectedMonth && typeof selectedMonth === 'string' && selectedMonth.match(/^\d{4}-\d{2}$/)) {
    return selectedMonth;
  }
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
}

function formatDueLong(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  const day = dt.getDate();
  const month = dt.toLocaleDateString('pt-BR', { month: 'long' });
  return `${String(day).padStart(2, '0')} de ${month.charAt(0).toUpperCase()}${month.slice(1)}`;
}

function formatDueShort(isoDate) {
  if (!isoDate) return '';
  const [, m, d] = isoDate.split('-');
  return `${d}/${m}`;
}

function paymentStatusLabel(pago, pagamento) {
  if (!pago) return 'Pendente';
  const forma = String(pagamento?.forma_pagamento || '').trim();
  if (!forma) return 'Pago';
  if (/cart/i.test(forma)) return 'Cartão';
  return forma;
}

function CobrancaRow({ item, onOpenPayment, onOpenManage, onQuickPay, paying }) {
  const { cobranca, competencia, pago, pagamento } = item;
  const [offsetX, setOffsetX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startXRef = useRef(0);
  const startOffsetRef = useRef(0);

  const onTouchStart = (e) => {
    if (pago || paying) return;
    startXRef.current = e.touches[0].clientX;
    startOffsetRef.current = offsetX;
    setDragging(true);
  };

  const onTouchMove = (e) => {
    if (pago || paying) return;
    const dx = e.touches[0].clientX - startXRef.current;
    const next = Math.max(0, Math.min(96, startOffsetRef.current + dx));
    setOffsetX(next);
  };

  const onTouchEnd = async () => {
    setDragging(false);
    if (pago || paying) return;
    if (offsetX >= SWIPE_PAY_THRESHOLD_PX) {
      setOffsetX(0);
      await onQuickPay?.();
      return;
    }
    setOffsetX(0);
  };

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-[#1E2A3A]/80 bg-[#0f1419]/40',
        pago && 'border-[#1E2A3A]/50 bg-[#0f1419]/20'
      )}
    >
      {!pago ? (
        <div
          className="absolute inset-y-0 left-0 flex w-24 items-center justify-center bg-primary text-primary-foreground"
          aria-hidden
        >
          <Check className="h-6 w-6" strokeWidth={2.5} />
        </div>
      ) : null}

      <div
        className={cn(
          'relative flex w-full items-center gap-3 px-3 py-3 transition-transform',
          dragging ? 'duration-0' : 'duration-200 ease-out'
        )}
        style={{ transform: `translateX(${offsetX}px)` }}
      >
        <SubscriptionBrandAvatar
          titulo={cobranca.titulo}
          categoria={cobranca.categoria}
          size={44}
        />

        <button
          type="button"
          onClick={() => (pago ? onOpenManage?.() : onOpenPayment?.())}
          disabled={paying}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          className={cn(
            'min-w-0 flex-1 text-left',
            !pago && !paying && 'cursor-pointer',
            paying && 'pointer-events-none'
          )}
        >
          <p
            className={cn(
              'truncate text-[15px] font-semibold leading-snug text-foreground',
              pago && 'text-muted-foreground line-through decoration-muted-foreground/50'
            )}
          >
            {cobranca.titulo}
          </p>
          <p className="mt-0.5 text-xs font-medium text-muted-foreground">
            Vence {formatDueShort(competencia)}
            <span className="text-muted-foreground/50"> · </span>
            <span className={pago ? 'text-primary/90' : 'text-amber-400/95'}>
              {paymentStatusLabel(pago, pagamento)}
            </span>
          </p>
        </button>

        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className={cn(
              'text-[15px] font-bold tabular-nums tracking-tight',
              pago ? 'text-muted-foreground' : 'text-foreground'
            )}
          >
            {formatBRL(cobranca.valor)}
          </span>
          {pago ? (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary">
              <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
            </span>
          ) : paying ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
          ) : null}
          <button
            type="button"
            onClick={() => onOpenManage?.()}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
            aria-label={`Opções: ${cobranca.titulo}`}
          >
            <MoreVertical className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children, count }) {
  return (
    <div className="flex items-center justify-between gap-2 px-0.5 pb-2 pt-1">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{children}</p>
      {count != null ? (
        <span className="rounded-full bg-[#1E2A3A] px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
          {count}
        </span>
      ) : null}
    </div>
  );
}

export default function CobrancasDoMes({ userId, selectedMonth, onAfterPayment }) {
  const [cobrancas, setCobrancas] = useState([]);
  const [pagamentos, setPagamentos] = useState([]);
  const [loading, setLoading] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [formTitulo, setFormTitulo] = useState('');
  const [formValor, setFormValor] = useState('');
  const [formDia, setFormDia] = useState('2');
  const [formCategoria, setFormCategoria] = useState('Servicos');

  const [checkinOpen, setCheckinOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [selectedCobranca, setSelectedCobranca] = useState(null);
  const [selectedCompetencia, setSelectedCompetencia] = useState('');
  const [formaPagamento, setFormaPagamento] = useState('Pix');
  const [obs, setObs] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingNew, setSavingNew] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [payingId, setPayingId] = useState(null);
  const [expanded, setExpanded] = useState(false);

  const monthKey = useMemo(() => ensureMonthKey(selectedMonth), [selectedMonth]);
  const monthInfo = useMemo(() => {
    const [y, m] = monthKey.split('-').map(Number);
    return { year: y, monthIndex: (m || 1) - 1 };
  }, [monthKey]);

  const paidMap = useMemo(() => {
    const map = new Map();
    for (const p of pagamentos || []) {
      map.set(`${p.cobranca_id}_${p.competencia}`, p);
    }
    return map;
  }, [pagamentos]);

  const dueItems = useMemo(() => {
    const items = [];
    for (const c of cobrancas || []) {
      if (!c || !c.ativa) continue;
      if (c.recorrencia !== 'mensal') continue;

      const competencia = computeDueDateMensal(c.dia_vencimento || 2, monthInfo.year, monthInfo.monthIndex);
      const key = `${c.id}_${competencia}`;
      const pagamento = paidMap.get(key);
      items.push({
        cobranca: c,
        competencia,
        pago: !!pagamento,
        pagamento,
      });
    }
    items.sort((a, b) => (a.competencia < b.competencia ? -1 : 1));
    return items;
  }, [cobrancas, monthInfo, paidMap]);

  const pendingItems = useMemo(() => dueItems.filter((it) => !it.pago), [dueItems]);
  const paidItems = useMemo(() => dueItems.filter((it) => it.pago), [dueItems]);

  const monthTotal = useMemo(
    () => dueItems.reduce((sum, it) => sum + (Number(it.cobranca.valor) || 0), 0),
    [dueItems]
  );

  const pendingTotal = useMemo(
    () => pendingItems.reduce((sum, it) => sum + (Number(it.cobranca.valor) || 0), 0),
    [pendingItems]
  );

  const nextDueSubtitle = useMemo(() => {
    if (dueItems.length === 0) return 'Nenhum compromisso neste mês';
    if (!expanded) {
      const n = dueItems.length;
      const p = pendingItems.length;
      if (p > 0) return `${p} a pagar de ${n} · Toque para ver`;
      return `${n} compromisso${n === 1 ? '' : 's'} · Toque para ver`;
    }
    const target = pendingItems[0] || dueItems[0];
    if (!target) return `${dueItems.length} no mês`;
    return `Próximo: ${formatDueLong(target.competencia)}`;
  }, [dueItems, expanded, pendingItems]);

  const load = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/cobrancas?month=${encodeURIComponent(monthKey)}`, {
        method: 'GET',
        credentials: 'include',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Erro ${res.status}`);
      }
      setCobrancas(Array.isArray(json.cobrancas) ? json.cobrancas : []);
      setPagamentos(Array.isArray(json.pagamentos) ? json.pagamentos : []);
    } catch (e) {
      console.error('Erro ao carregar cobrancas do mes:', e);
      toast.error(e?.message || 'Erro ao carregar compromissos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, monthKey]);

  useEffect(() => {
    const onRefresh = () => load();
    window.addEventListener('finmemory:cobrancas-refresh', onRefresh);
    return () => window.removeEventListener('finmemory:cobrancas-refresh', onRefresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, monthKey]);

  const openCheckin = (cobranca, competencia) => {
    setSelectedCobranca(cobranca);
    setSelectedCompetencia(competencia);
    setFormaPagamento('Pix');
    setObs('');
    setManageOpen(false);
    setCheckinOpen(true);
  };

  const openManage = (cobranca, competencia) => {
    setSelectedCobranca(cobranca);
    setSelectedCompetencia(competencia || '');
    setCheckinOpen(false);
    setManageOpen(true);
  };

  const registerPayment = async (cobranca, competencia, { forma = 'Pix', observacao = null } = {}) => {
    if (!userId || !cobranca) return false;
    const payKey = `${cobranca.id}_${competencia}`;
    setPayingId(payKey);
    try {
      const res = await fetch('/api/cobrancas/pagamento', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cobranca_id: cobranca.id,
          competencia,
          forma_pagamento: forma || null,
          obs: observacao,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Erro ${res.status}`);
      }
      toast.success('Pagamento registrado');
      await onAfterPayment?.();
      await load();
      return true;
    } catch (e) {
      console.error('Erro ao confirmar pagamento:', e);
      toast.error(e?.message || 'Erro ao registrar pagamento');
      return false;
    } finally {
      setPayingId(null);
    }
  };

  const removeCobranca = async (cobranca) => {
    if (!userId || !cobranca?.id) return;
    const ok = window.confirm(
      `Remover "${cobranca.titulo}" do app?\n\nDeixa de aparecer nos próximos meses. Pagamentos já registrados permanecem no histórico.`
    );
    if (!ok) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/cobrancas?id=${encodeURIComponent(cobranca.id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Erro ${res.status}`);
      }
      toast.success('Compromisso removido');
      setManageOpen(false);
      setCheckinOpen(false);
      setSelectedCobranca(null);
      setSelectedCompetencia('');
      await load();
    } catch (e) {
      console.error('Erro ao remover cobranca:', e);
      toast.error(e?.message || 'Erro ao remover');
    } finally {
      setDeleting(false);
    }
  };

  const handleAdd = async () => {
    if (!userId) {
      toast.error('Sua conta ainda não carregou. Aguarde um instante ou faça login de novo.');
      return;
    }
    const titulo = (formTitulo || '').trim();
    const valor = parseValor(formValor);
    const dia = Number(formDia) || 2;
    if (!titulo) return toast.error('Informe o título');
    if (valor == null || valor <= 0) {
      return toast.error('Informe um valor válido (ex: 39,90 ou 39.90)');
    }

    setSavingNew(true);
    try {
      const res = await fetch('/api/cobrancas', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo,
          valor,
          dia_vencimento: dia,
          categoria: (formCategoria || '').trim() || 'Servicos',
          recorrencia: 'mensal',
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        const msg = [json.error, json.hint].filter(Boolean).join(' — ');
        throw new Error(msg || `Erro ${res.status}`);
      }
      setAddOpen(false);
      setFormTitulo('');
      setFormValor('');
      setFormDia('2');
      setFormCategoria('Servicos');
      setExpanded(true);
      await load();
      toast.success('Compromisso adicionado');
    } catch (e) {
      console.error('Erro ao adicionar cobranca:', e);
      toast.error(e?.message || 'Erro ao adicionar');
    } finally {
      setSavingNew(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!selectedCobranca) return;
    setSaving(true);
    const ok = await registerPayment(selectedCobranca, selectedCompetencia, {
      forma: formaPagamento,
      observacao: obs || null,
    });
    setSaving(false);
    if (ok) {
      setCheckinOpen(false);
      setSelectedCobranca(null);
      setSelectedCompetencia('');
      setObs('');
    }
  };

  const renderItem = (it) => {
    const rowKey = `${it.cobranca.id}_${it.competencia}`;
    return (
      <li key={rowKey}>
        <CobrancaRow
          item={it}
          paying={payingId === rowKey}
          onOpenPayment={() => openCheckin(it.cobranca, it.competencia)}
          onOpenManage={() => openManage(it.cobranca, it.competencia)}
          onQuickPay={() => registerPayment(it.cobranca, it.competencia, { forma: 'Pix' })}
        />
      </li>
    );
  };

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-[#1E2A3A] bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          'flex w-full items-start justify-between gap-3 px-4 py-4 text-left transition-colors hover:bg-white/[0.03]',
          expanded && 'border-b border-[#1E2A3A]'
        )}
        aria-expanded={expanded}
        aria-label={expanded ? 'Recolher compromissos do mês' : 'Ver compromissos do mês'}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <h2 className="text-base font-bold tracking-tight text-foreground">Compromissos do Mês</h2>
          </div>
          <p className="mt-1 text-xs font-medium text-muted-foreground">{nextDueSubtitle}</p>
          {expanded && pendingItems.length > 0 ? (
            <p className="mt-0.5 text-xs text-amber-400/90">
              Falta pagar: {formatBRL(pendingTotal)}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5 pt-0.5">
          <p className="text-lg font-bold tabular-nums text-foreground">{formatBRL(monthTotal)}</p>
          <ChevronDown
            className={cn(
              'h-5 w-5 text-muted-foreground transition-transform duration-200',
              expanded && 'rotate-180'
            )}
            aria-hidden
          />
        </div>
      </button>

      {expanded ? (
        <>
          <div className="px-4 pb-4">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm font-medium text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Carregando...
              </div>
            ) : dueItems.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhum compromisso neste mês.
              </p>
            ) : (
              <div className="space-y-4">
                {pendingItems.length > 0 ? (
                  <div>
                    <SectionLabel count={pendingItems.length}>A pagar</SectionLabel>
                    <ul className="space-y-2">{pendingItems.map(renderItem)}</ul>
                  </div>
                ) : null}
                {paidItems.length > 0 ? (
                  <div>
                    <SectionLabel count={paidItems.length}>Pagos neste mês</SectionLabel>
                    <ul className="space-y-2">{paidItems.map(renderItem)}</ul>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <footer className="border-t border-[#1E2A3A] px-4 py-3">
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
              Adicionar compromisso
            </button>
            {!loading && dueItems.length > 0 ? (
              <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
                Logos por serviço · toque na linha para pagar · ⋮ para remover · arraste → para marcar pago
              </p>
            ) : null}
          </footer>
        </>
      ) : null}

      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-y-auto rounded-t-3xl border-[#1E2A3A] bg-card px-5 pb-10 pt-4"
        >
          <SheetHeader className="mb-4">
            <SheetTitle className="text-center text-lg font-bold">Novo compromisso</SheetTitle>
            <p className="text-center text-xs text-muted-foreground">Recorrente mensal</p>
          </SheetHeader>

          <div className="space-y-4">
            <div>
              <p className="mb-1 text-sm font-medium text-foreground">Nome do serviço</p>
              <input
                className="w-full rounded-xl border border-[#1E2A3A] bg-background px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                value={formTitulo}
                onChange={(e) => setFormTitulo(e.target.value)}
                placeholder="Ex: Netflix, Amazon Prime, Canva, Cursor..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ExpressionValueField
                label="Valor (R$)"
                value={formValor}
                onChange={setFormValor}
                mode="money"
                placeholder="Ex: 39,90"
                inputClassName="rounded-xl border-[#1E2A3A]"
                hint="Teclado com + − × ÷."
              />
              <ExpressionValueField
                label="Dia (venc.)"
                value={formDia}
                onChange={setFormDia}
                mode="integer"
                integerMin={1}
                integerMax={31}
                inputClassName="rounded-xl border-[#1E2A3A]"
                hint="Dia 1–31."
              />
            </div>
            <div>
              <p className="mb-1 text-sm font-medium text-foreground">Categoria</p>
              <input
                className="w-full rounded-xl border border-[#1E2A3A] bg-background px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                value={formCategoria}
                onChange={(e) => setFormCategoria(e.target.value)}
                placeholder="Streaming, Servicos..."
              />
            </div>

            <button
              type="button"
              disabled={savingNew}
              onClick={handleAdd}
              className="h-12 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:opacity-95 disabled:opacity-60"
            >
              {savingNew ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={checkinOpen} onOpenChange={setCheckinOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-y-auto rounded-t-3xl border-[#1E2A3A] bg-card px-5 pb-10 pt-4"
        >
          <SheetHeader className="mb-4">
            <SheetTitle className="text-center text-lg font-bold">Registrar pagamento</SheetTitle>
            {selectedCobranca ? (
              <div className="mt-3 flex items-center justify-center gap-3">
                <SubscriptionBrandAvatar
                  titulo={selectedCobranca.titulo}
                  categoria={selectedCobranca.categoria}
                  size={48}
                />
                <div className="text-left">
                  <p className="text-sm font-bold text-foreground">{selectedCobranca.titulo}</p>
                  <p className="text-xs text-muted-foreground">
                    Vence {formatDueShort(selectedCompetencia)} · {formatBRL(selectedCobranca.valor)}
                  </p>
                </div>
              </div>
            ) : null}
          </SheetHeader>

          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Forma de pagamento</p>
              <div className="grid grid-cols-2 gap-2">
                {['Pix', 'Cartao', 'Dinheiro', 'Boleto'].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setFormaPagamento(v)}
                    className={cn(
                      'h-10 rounded-xl text-xs font-semibold',
                      formaPagamento === v
                        ? 'bg-primary text-primary-foreground'
                        : 'border border-[#1E2A3A] bg-background text-foreground'
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1 text-sm font-medium text-foreground">Obs (opcional)</p>
              <input
                className="w-full rounded-xl border border-[#1E2A3A] bg-background px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                placeholder="Ex: desconto, parcela..."
              />
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={handleConfirmPayment}
              className="h-12 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {saving ? 'Salvando...' : 'Confirmar pagamento'}
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={manageOpen} onOpenChange={setManageOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-y-auto rounded-t-3xl border-[#1E2A3A] bg-card px-5 pb-10 pt-4"
        >
          <SheetHeader className="mb-4">
            <SheetTitle className="text-center text-lg font-bold">Gerenciar compromisso</SheetTitle>
            {selectedCobranca ? (
              <div className="mt-3 flex items-center gap-3 rounded-2xl border border-[#1E2A3A] bg-background/80 p-3">
                <SubscriptionBrandAvatar
                  titulo={selectedCobranca.titulo}
                  categoria={selectedCobranca.categoria}
                  size={52}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-bold text-foreground">{selectedCobranca.titulo}</p>
                  <p className="text-sm font-semibold tabular-nums text-foreground">
                    {formatBRL(selectedCobranca.valor)} / mês
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Vencimento dia {selectedCobranca.dia_vencimento || 2}
                  </p>
                </div>
              </div>
            ) : null}
          </SheetHeader>

          <div className="space-y-3">
            {selectedCobranca && selectedCompetencia ? (
              <button
                type="button"
                onClick={() => {
                  setManageOpen(false);
                  openCheckin(selectedCobranca, selectedCompetencia);
                }}
                className="h-12 w-full rounded-xl border border-[#1E2A3A] bg-background text-sm font-semibold text-foreground hover:bg-white/[0.04]"
              >
                Registrar pagamento deste mês
              </button>
            ) : null}

            <button
              type="button"
              disabled={deleting || !selectedCobranca}
              onClick={() => removeCobranca(selectedCobranca)}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 text-sm font-semibold text-red-400 hover:bg-red-500/15 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" strokeWidth={2} aria-hidden />
              {deleting ? 'Removendo...' : 'Remover do app'}
            </button>
            <p className="text-center text-[11px] leading-snug text-muted-foreground">
              Some da lista em todos os meses. Histórico de pagamentos já feitos não é apagado.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}
