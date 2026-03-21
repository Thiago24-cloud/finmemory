'use client';

import { useEffect, useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/Sheet';
import { CalendarDays, CheckCircle2, PlusCircle } from 'lucide-react';
import { toast } from 'sonner';

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

/** Mesma lógica do visor da calculadora: aceita 39,90 / 39.90 / 1.234,56 / R$ 100 */
function parseValor(v) {
  let raw = (v || '').toString().trim();
  if (!raw) return null;
  raw = raw.replace(/\s/g, '').replace(/^R\$\s?/i, '');
  if (!raw) return null;
  // Com vírgula => formato BR (ponto milhar, vírgula decimal)
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

export default function CobrancasDoMes({
  userId,
  selectedMonth,
  onAfterPayment,
}) {
  const [cobrancas, setCobrancas] = useState([]);
  const [pagamentos, setPagamentos] = useState([]);
  const [loading, setLoading] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [formTitulo, setFormTitulo] = useState('');
  const [formValor, setFormValor] = useState('');
  const [formDia, setFormDia] = useState('2'); // padrão dia 2
  const [formCategoria, setFormCategoria] = useState('Servicos');

  const [checkinOpen, setCheckinOpen] = useState(false);
  const [selectedCobranca, setSelectedCobranca] = useState(null);
  const [selectedCompetencia, setSelectedCompetencia] = useState('');
  const [formaPagamento, setFormaPagamento] = useState('Pix');
  const [obs, setObs] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingNew, setSavingNew] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const monthKey = useMemo(() => ensureMonthKey(selectedMonth), [selectedMonth]);
  const monthLabel = useMemo(() => {
    const [y, m] = monthKey.split('-').map(Number);
    const dt = new Date(y, (m || 1) - 1, 1);
    return dt.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }, [monthKey]);
  const monthInfo = useMemo(() => {
    const [y, m] = monthKey.split('-').map(Number);
    return { year: y, monthIndex: (m || 1) - 1 };
  }, [monthKey]);

  const monthStart = useMemo(() => `${monthKey}-01`, [monthKey]);
  const monthEnd = useMemo(() => {
    const lastDay = new Date(monthInfo.year, monthInfo.monthIndex + 1, 0).getDate();
    return toLocalISODate(new Date(monthInfo.year, monthInfo.monthIndex, lastDay));
  }, [monthInfo]);

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
      if (c.recorrencia !== 'mensal') continue; // MVP: só mensal

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
    // ordenar por competencia
    items.sort((a, b) => (a.competencia < b.competencia ? -1 : 1));
    return items;
  }, [cobrancas, monthInfo, paidMap]);

  const unpaidTotal = useMemo(() => {
    return dueItems.reduce((sum, it) => (it.pago ? sum : sum + Number(it.cobranca.valor) || 0), 0);
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
      toast.error(e?.message || 'Erro ao carregar cobranças');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, monthKey]);

  const openCheckin = (cobranca, competencia) => {
    setSelectedCobranca(cobranca);
    setSelectedCompetencia(competencia);
    setFormaPagamento('Pix');
    setObs('');
    setCheckinOpen(true);
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
      toast.success('Cobrança adicionada');
    } catch (e) {
      console.error('Erro ao adicionar cobranca:', e);
      toast.error(e?.message || 'Erro ao adicionar cobrança');
    } finally {
      setSavingNew(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!userId || !selectedCobranca) return;
    setSaving(true);
    try {
      const res = await fetch('/api/cobrancas/pagamento', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cobranca_id: selectedCobranca.id,
          competencia: selectedCompetencia,
          forma_pagamento: formaPagamento || null,
          obs: obs || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Erro ${res.status}`);
      }

      toast.success('Pagamento registrado!');
      setCheckinOpen(false);
      setSelectedCobranca(null);
      setSelectedCompetencia('');
      setObs('');
      await onAfterPayment?.();
      await load();
    } catch (e) {
      console.error('Erro ao confirmar pagamento:', e);
      toast.error(e?.message || 'Erro ao registrar pagamento');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card-lovable bg-white rounded-2xl p-4 mb-6">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left flex items-start justify-between gap-3"
        aria-label="Abrir ou fechar cobranças do mês"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#333] flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            Cobranças do mês
          </p>
          <p className="text-xs text-[#666]">{monthLabel} · check-in quando pagar</p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="text-[10px] text-[#666] mb-0.5">Não pagas</p>
            <p className="text-sm font-bold text-[#333]">{formatBRL(unpaidTotal)}</p>
          </div>

          <div
            className={
              expanded
                ? 'w-9 h-9 rounded-2xl bg-[#e8f5e9] border border-[#c8e6c9] text-[#28a745] flex items-center justify-center font-bold'
                : 'w-9 h-9 rounded-2xl bg-white border border-[#e5e7eb] text-[#666] flex items-center justify-center font-bold'
            }
          >
            {expanded ? '−' : '+'}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="mt-3">
          {loading ? (
            <div className="text-xs text-[#666]">Carregando...</div>
          ) : dueItems.length === 0 ? (
            <div className="text-xs text-[#666]">Nenhuma cobrança para este mês. Toque em Adicionar.</div>
          ) : (
            <div className="space-y-2 max-h-[210px] overflow-y-auto pr-1">
              {dueItems.map((it) => {
                const { cobranca, competencia, pago } = it;
                return (
                  <div
                    key={`${cobranca.id}_${competencia}`}
                    className="flex items-start justify-between gap-3 p-3 rounded-xl border border-[#e5e7eb] bg-[#f8f9fa]/40"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-[#666]">{competencia}</span>
                        {pago ? (
                          <span className="text-xs inline-flex items-center gap-1 text-[#16a34a] font-semibold">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Pago
                          </span>
                        ) : (
                          <span className="text-xs text-[#666]">Agendado</span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-[#333] truncate">{cobranca.titulo}</p>
                      <p className="text-xs text-[#666]">{formatBRL(cobranca.valor)}</p>
                    </div>

                    {!pago ? (
                      <button
                        type="button"
                        onClick={() => openCheckin(cobranca, competencia)}
                        className="shrink-0 px-3 py-2 rounded-xl bg-[#2ECC49] hover:bg-[#22a83a] text-white text-xs font-semibold"
                      >
                        Paguei
                      </button>
                    ) : (
                      <div className="shrink-0 w-20" />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="mt-3 w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-[#e8f5e9] border border-[#c8e6c9] text-[#28a745] text-sm font-semibold hover:bg-[#c8e6c9]"
          >
            <PlusCircle className="h-4 w-4" />
            Adicionar
          </button>
        </div>
      )}

      {/* Sheet adicionar cobranca */}
      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl px-5 pb-10 pt-4 max-h-[85vh] overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-lg font-bold text-center">Nova cobrança (mensal)</SheetTitle>
            <p className="text-xs text-[#666] text-center">Padrão dia 2</p>
          </SheetHeader>

          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-[#333] mb-1">Título</p>
              <input
                className="w-full px-4 py-2 rounded-xl border border-[#e5e7eb] bg-white text-[#333] focus:outline-none focus:ring-2 focus:ring-[#2ECC49]/40"
                value={formTitulo}
                onChange={(e) => setFormTitulo(e.target.value)}
                placeholder="Ex: Streaming, Luz..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-sm font-medium text-[#333] mb-1">Valor (R$)</p>
                <input
                  className="w-full px-4 py-2 rounded-xl border border-[#e5e7eb] bg-white text-[#333] focus:outline-none focus:ring-2 focus:ring-[#2ECC49]/40"
                  value={formValor}
                  onChange={(e) => setFormValor(e.target.value)}
                  inputMode="decimal"
                  placeholder="Ex: 39,90"
                />
              </div>
              <div>
                <p className="text-sm font-medium text-[#333] mb-1">Dia (venc.)</p>
                <input
                  className="w-full px-4 py-2 rounded-xl border border-[#e5e7eb] bg-white text-[#333] focus:outline-none focus:ring-2 focus:ring-[#2ECC49]/40"
                  value={formDia}
                  onChange={(e) => setFormDia(e.target.value)}
                  inputMode="numeric"
                />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-[#333] mb-1">Categoria</p>
              <input
                className="w-full px-4 py-2 rounded-xl border border-[#e5e7eb] bg-white text-[#333] focus:outline-none focus:ring-2 focus:ring-[#2ECC49]/40"
                value={formCategoria}
                onChange={(e) => setFormCategoria(e.target.value)}
                placeholder="Servicos"
              />
            </div>

            <button
              type="button"
              disabled={savingNew}
              onClick={handleAdd}
              className="w-full h-12 rounded-xl bg-[#2ECC49] hover:bg-[#22a83a] text-white text-sm font-semibold disabled:opacity-60"
            >
              {savingNew ? 'Salvando...' : 'Salvar cobrança'}
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet check-in pagamento */}
      <Sheet open={checkinOpen} onOpenChange={setCheckinOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl px-5 pb-10 pt-4 max-h-[85vh] overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-lg font-bold text-center">Registrar pagamento</SheetTitle>
            {selectedCobranca ? (
              <p className="text-xs text-[#666] text-center">
                {selectedCobranca.titulo} · competencia {selectedCompetencia}
              </p>
            ) : null}
          </SheetHeader>

          <div className="space-y-4">
            {selectedCobranca ? (
              <div className="bg-background border border-border rounded-xl p-3">
                <p className="text-xs text-[#666] mb-1">Valor</p>
                <p className="text-sm font-bold text-[#333]">{formatBRL(selectedCobranca.valor)}</p>
              </div>
            ) : null}

            <div>
              <p className="text-sm font-medium text-[#333] mb-2">Forma de pagamento</p>
              <div className="grid grid-cols-2 gap-2">
                {['Pix', 'Cartao', 'Dinheiro', 'Boleto'].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setFormaPagamento(v)}
                    className={
                      formaPagamento === v
                        ? 'h-10 rounded-xl bg-[#2ECC49] text-white text-xs font-semibold'
                        : 'h-10 rounded-xl bg-white border border-[#e5e7eb] text-[#333] text-xs font-semibold'
                    }
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-[#333] mb-1">Obs (opcional)</p>
              <input
                className="w-full px-4 py-2 rounded-xl border border-[#e5e7eb] bg-white text-[#333] focus:outline-none focus:ring-2 focus:ring-[#2ECC49]/40"
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                placeholder="Ex: desconto, parcela..."
              />
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={handleConfirmPayment}
              className="w-full h-12 rounded-xl bg-[#2ECC49] hover:bg-[#22a83a] text-white text-sm font-semibold disabled:opacity-60"
            >
              {saving ? 'Salvando...' : 'Paguei'}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

