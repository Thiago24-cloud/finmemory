'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  Check,
  CreditCard,
  FileText,
  Home,
  Loader2,
  Plus,
  Receipt,
  Tv,
  Zap,
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/Sheet';
import { ExpressionValueField } from '../ui/ExpressionValueField';
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

function pickCategoryVisual(titulo, categoria) {
  const t = `${titulo || ''} ${categoria || ''}`.toLowerCase();
  if (/netflix|streaming|spotify|disney|prime|hbo|tv/.test(t)) {
    return { Icon: Tv, ring: 'text-violet-400', bg: 'bg-violet-500/15' };
  }
  if (/luz|energia|eletr/.test(t)) {
    return { Icon: Zap, ring: 'text-amber-400', bg: 'bg-amber-500/15' };
  }
  if (/boleto/.test(t)) {
    return { Icon: FileText, ring: 'text-sky-400', bg: 'bg-sky-500/15' };
  }
  if (/empr[eé]stimo|financi|hipoteca|aluguel/.test(t)) {
    return { Icon: Home, ring: 'text-orange-400', bg: 'bg-orange-500/15' };
  }
  if (/cart[aã]o|credito|crédito/.test(t)) {
    return { Icon: CreditCard, ring: 'text-emerald-400', bg: 'bg-emerald-500/15' };
  }
  return { Icon: Receipt, ring: 'text-primary', bg: 'bg-primary/10' };
}

function paymentStatusLabel(pago, pagamento) {
  if (!pago) return 'Pendente';
  const forma = String(pagamento?.forma_pagamento || '').trim();
  if (!forma) return 'Pago';
  if (/cart/i.test(forma)) return 'Cartão';
  return forma;
}

function CobrancaRow({ item, onOpenDetail, onQuickPay, paying }) {
  const { cobranca, competencia, pago, pagamento } = item;
  const { Icon, ring, bg } = pickCategoryVisual(cobranca.titulo, cobranca.categoria);
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

  const handleClick = () => {
    if (pago) return;
    onOpenDetail?.();
  };

  return (
    <div className="relative overflow-hidden">
      {!pago ? (
        <div
          className="absolute inset-y-0 left-0 flex w-24 items-center justify-center bg-primary text-primary-foreground"
          aria-hidden
        >
          <Check className="h-6 w-6" strokeWidth={2.5} />
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleClick}
        disabled={pago || paying}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className={cn(
          'relative flex w-full items-center gap-3 py-3.5 text-left transition-transform',
          dragging ? 'duration-0' : 'duration-200 ease-out',
          pago ? 'opacity-55' : 'hover:bg-white/[0.03] active:bg-white/[0.05]',
          !pago && !paying && 'cursor-pointer'
        )}
        style={{ transform: `translateX(${offsetX}px)` }}
      >
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
            bg,
            ring
          )}
        >
          <Icon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'truncate text-[15px] font-semibold text-foreground',
              pago && 'line-through decoration-white/30'
            )}
          >
            {cobranca.titulo}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Vence em {formatDueShort(competencia)}
            <span className="text-muted-foreground/60"> · </span>
            {paymentStatusLabel(pago, pagamento)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2 pl-1">
          <span
            className={cn(
              'text-[15px] font-semibold tabular-nums',
              pago ? 'text-muted-foreground' : 'text-foreground'
            )}
          >
            {formatBRL(cobranca.valor)}
          </span>
          {pago ? (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
            </span>
          ) : paying ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
          ) : null}
        </div>
      </button>
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
  const [selectedCobranca, setSelectedCobranca] = useState(null);
  const [selectedCompetencia, setSelectedCompetencia] = useState('');
  const [formaPagamento, setFormaPagamento] = useState('Pix');
  const [obs, setObs] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingNew, setSavingNew] = useState(false);
  const [payingId, setPayingId] = useState(null);

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

  const monthTotal = useMemo(
    () => dueItems.reduce((sum, it) => sum + (Number(it.cobranca.valor) || 0), 0),
    [dueItems]
  );

  const nextDueSubtitle = useMemo(() => {
    const pending = dueItems.filter((it) => !it.pago);
    const target = pending[0] || dueItems[0];
    if (!target) return 'Nenhum compromisso neste mês';
    return `Próximo vencimento: ${formatDueLong(target.competencia)}`;
  }, [dueItems]);

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
    setCheckinOpen(true);
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

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-[#1E2A3A] bg-card">
      <header className="flex items-start justify-between gap-4 border-b border-[#1E2A3A]/80 px-4 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <h2 className="text-base font-bold tracking-tight text-foreground">Compromissos do Mês</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{nextDueSubtitle}</p>
        </div>
        <p className="shrink-0 text-lg font-bold tabular-nums text-foreground">{formatBRL(monthTotal)}</p>
      </header>

      <div className="px-4">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Carregando...
          </div>
        ) : dueItems.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum compromisso neste mês.
          </p>
        ) : (
          <ul className="divide-y divide-[#1E2A3A]/90">
            {dueItems.map((it) => {
              const rowKey = `${it.cobranca.id}_${it.competencia}`;
              return (
                <li key={rowKey}>
                  <CobrancaRow
                    item={it}
                    paying={payingId === rowKey}
                    onOpenDetail={() => openCheckin(it.cobranca, it.competencia)}
                    onQuickPay={() => registerPayment(it.cobranca, it.competencia, { forma: 'Pix' })}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <footer className="border-t border-[#1E2A3A]/80 px-4 py-3">
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
          Adicionar nova cobrança
        </button>
        {!loading && dueItems.length > 0 ? (
          <p className="mt-1 text-[10px] text-muted-foreground/80">
            Toque na linha para detalhes · arraste para a direita para marcar como pago
          </p>
        ) : null}
      </footer>

      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-y-auto rounded-t-3xl border-[#1E2A3A] bg-card px-5 pb-10 pt-4"
        >
          <SheetHeader className="mb-4">
            <SheetTitle className="text-center text-lg font-bold">Nova cobrança (mensal)</SheetTitle>
            <p className="text-center text-xs text-muted-foreground">Padrão dia 2</p>
          </SheetHeader>

          <div className="space-y-4">
            <div>
              <p className="mb-1 text-sm font-medium text-foreground">Título</p>
              <input
                className="w-full rounded-xl border border-[#1E2A3A] bg-background px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                value={formTitulo}
                onChange={(e) => setFormTitulo(e.target.value)}
                placeholder="Ex: Netflix, Luz..."
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
                className="w-full rounded-xl border border-[#1E2A3A] bg-background px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                value={formCategoria}
                onChange={(e) => setFormCategoria(e.target.value)}
                placeholder="Servicos"
              />
            </div>

            <button
              type="button"
              disabled={savingNew}
              onClick={handleAdd}
              className="h-12 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:opacity-95 disabled:opacity-60"
            >
              {savingNew ? 'Salvando...' : 'Salvar cobrança'}
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
              <p className="text-center text-xs text-muted-foreground">
                {selectedCobranca.titulo} · vence {formatDueShort(selectedCompetencia)}
              </p>
            ) : null}
          </SheetHeader>

          <div className="space-y-4">
            {selectedCobranca ? (
              <div className="rounded-xl border border-[#1E2A3A] bg-background p-3">
                <p className="mb-1 text-xs text-muted-foreground">Valor</p>
                <p className="text-sm font-bold text-foreground">{formatBRL(selectedCobranca.valor)}</p>
              </div>
            ) : null}

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
                className="w-full rounded-xl border border-[#1E2A3A] bg-background px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
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
    </section>
  );
}
