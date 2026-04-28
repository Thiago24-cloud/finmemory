'use client';

import { useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  Car,
  Coffee,
  Fuel,
  Home,
  Info,
  Pencil,
  Pill,
  Receipt,
  Search,
  Shirt,
  ShoppingBag,
  Smartphone,
  Trash2,
  Utensils,
  Wrench,
  Check,
  Plus,
  Minus,
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/Sheet';
import { cn } from '../../lib/utils';
import { getCategoryColor } from '../../lib/colors';
import { buildUnifiedHistoryGroups } from '../../lib/mergeHistoryTimeline';
import { buildReceiptShareText, whatsAppShareUrl } from '../../lib/buildReceiptShareText';
import {
  resolveMerchantDisplayName,
  saveMerchantAlias,
} from '../../lib/merchantDisplayAlias';
import { pickOpenFinanceEssentialFields } from '../../lib/openFinanceTransactionEssentials';
import { useCalculatorDockOptional } from './CalculatorDockContext';
import { CALC_DRAG_MIME } from '../../lib/calcDragMime';

function categoryIconOpenFinance(category) {
  const c = (category || '').toLowerCase();
  if (c.includes('restaurant') || c.includes('aliment')) return Utensils;
  if (c.includes('combust') || c.includes('fuel') || c.includes('posto')) return Fuel;
  if (c.includes('mercado') || c.includes('grocery') || c.includes('supermercado')) return ShoppingBag;
  if (c.includes('moradia') || c.includes('home') || c.includes('aluguel')) return Home;
  if (c.includes('telecom') || c.includes('internet') || c.includes('mobile')) return Smartphone;
  if (c.includes('cafe') || c.includes('coffee')) return Coffee;
  if (c.includes('banco') || c.includes('transfer')) return Building2;
  return null;
}

const fmCategoryIcons = {
  transporte: Car,
  uber: Car,
  supermercado: ShoppingBag,
  mercado: ShoppingBag,
  restaurante: Utensils,
  lanchonete: Utensils,
  alimentação: Utensils,
  combustível: Fuel,
  posto: Fuel,
  farmácia: Pill,
  eletrônicos: Smartphone,
  vestuário: Shirt,
  roupas: Shirt,
  serviços: Wrench,
  padaria: Receipt,
};

function getFinMemoryCategoryIcon(category, merchant) {
  const lowerCategory = (category || '').toLowerCase();
  const lowerMerchant = (merchant || '').toLowerCase();
  for (const [key, Icon] of Object.entries(fmCategoryIcons)) {
    if (lowerCategory.includes(key) || lowerMerchant.includes(key)) return Icon;
  }
  return Receipt;
}

function formatDateLabel(isoDate) {
  if (!isoDate) return '';
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatMoneyAbs(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(n));
}

function formatDateShort(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  } catch {
    return dateStr;
  }
}

function formatCurrency(value) {
  if (value == null) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function isTransactionNew(transaction) {
  if (transaction.created_at) {
    const d = new Date(transaction.created_at);
    if (!Number.isNaN(d.getTime())) {
      const age = Date.now() - d.getTime();
      return age >= 0 && age < 72 * 60 * 60 * 1000;
    }
  }
  if (transaction.data) {
    const s = String(transaction.data).trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const d = new Date(`${s}T12:00:00`);
      if (!Number.isNaN(d.getTime())) {
        const age = Date.now() - d.getTime();
        return age >= 0 && age < 96 * 60 * 60 * 1000;
      }
    }
  }
  return false;
}

/**
 * Histórico único: visual tipo extrato Open Finance + ações FinMemory (WhatsApp, mapa, editar, excluir).
 */
export function UnifiedHistoryList({
  openFinanceTransactions,
  finMemoryTransactions,
  openFinanceLoading,
  finMemoryLoading,
  userId,
  onDeleted,
  onRenamed,
  emptyState = 'default',
  className,
}) {
  const router = useRouter();
  const calcDock = useCalculatorDockOptional();
  const groups = useMemo(
    () => buildUnifiedHistoryGroups(openFinanceTransactions, finMemoryTransactions),
    [openFinanceTransactions, finMemoryTransactions]
  );

  const [deletingId, setDeletingId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editInitialRaw, setEditInitialRaw] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [openFinanceDetail, setOpenFinanceDetail] = useState(null);

  const loading = openFinanceLoading || finMemoryLoading;
  const totalRows = useMemo(() => groups.reduce((n, g) => n + g.items.length, 0), [groups]);

  const handleDelete = async (id) => {
    if (!userId || !onDeleted) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/transactions/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const json = await res.json();
      if (json.success) {
        setConfirmId(null);
        onDeleted();
      }
    } catch (e) {
      console.error('Erro ao deletar:', e);
    } finally {
      setDeletingId(null);
    }
  };

  const shareWhatsAppSummary = (transaction) => {
    let text = buildReceiptShareText(transaction);
    if (text.length > 5500) {
      text = `${text.slice(0, 5200)}\n\n… (truncado — abra a compra.)`;
    }
    window.open(whatsAppShareUrl(text), '_blank', 'noopener,noreferrer');
  };

  const startEdit = useCallback(
    (transaction) => {
      const raw = (transaction.estabelecimento && String(transaction.estabelecimento).trim()) || 'Local não informado';
      setEditingId(transaction.id);
      setEditInitialRaw(raw);
      setEditValue(resolveMerchantDisplayName(userId, raw));
    },
    [userId]
  );

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditValue('');
    setEditInitialRaw('');
  }, []);

  const saveTitle = useCallback(
    async (transaction) => {
      const trimmed = editValue.trim();
      if (!trimmed || !userId) {
        cancelEdit();
        return;
      }
      setSavingId(transaction.id);
      try {
        const res = await fetch(`/api/transactions/${transaction.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, estabelecimento: trimmed }),
        });
        const json = await res.json();
        if (json.success) {
          saveMerchantAlias(userId, editInitialRaw, trimmed);
          cancelEdit();
          if (typeof onRenamed === 'function') onRenamed();
        }
      } catch (e) {
        console.error(e);
      } finally {
        setSavingId(null);
      }
    },
    [userId, editValue, editInitialRaw, cancelEdit, onRenamed]
  );

  if (loading && totalRows === 0) {
    return (
      <div className={cn('space-y-4', className)} aria-busy="true" aria-live="polite">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 py-3">
            <div className="h-10 w-10 rounded-full bg-[#e5e7eb] animate-pulse shrink-0" />
            <div className="flex-1 space-y-2 min-w-0">
              <div className="h-4 w-[75%] max-w-[240px] bg-[#e5e7eb] rounded animate-pulse" />
              <div className="h-3 w-[50%] max-w-[160px] bg-[#e5e7eb] rounded animate-pulse" />
            </div>
            <div className="h-4 w-16 bg-[#e5e7eb] rounded animate-pulse shrink-0" />
          </div>
        ))}
      </div>
    );
  }

  if (!loading && totalRows === 0) {
    if (emptyState === 'search') {
      return (
        <div className={cn('text-center py-12', className)}>
          <Search className="h-16 w-16 mx-auto text-[#999] mb-4" />
          <h3 className="text-lg font-medium text-[#333] mb-2">Nenhum resultado</h3>
          <p className="text-sm text-[#666]">Tente outro termo de busca.</p>
        </div>
      );
    }
    return (
      <div className={cn('text-center py-12', className)}>
        <Receipt className="h-16 w-16 mx-auto text-[#ccc] mb-4" />
        <h3 className="text-lg font-medium text-[#333] mb-2">Sem movimentações</h3>
        <p className="text-sm text-[#666] max-w-sm mx-auto">
          Conecte o banco em Configurações ou escaneie uma nota fiscal. Quando houver correspondência com o banco, a
          nota aparece aqui e a linha duplicada do extrato some.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-[#333] m-0">Histórico</h2>
        <span className="text-sm text-[#666] tabular-nums">{totalRows} movimento(s)</span>
      </div>
      <p className="text-xs text-[#666] -mt-4 mb-1">
        Toque na linha da <strong>nota</strong> para abrir; no <strong>nome</strong> para renomear. Só banco: ícone de
        informação para dados resumidos.
        {calcDock
          ? ' Toque no valor ou use + / − para enviar à calculadora; no telemóvel também pode arrastar o valor até à barra em baixo.'
          : ''}
      </p>

      {groups.map(({ dateKey, items }) => (
        <section key={dateKey}>
          <h3 className="text-[11px] font-semibold text-[#a3a3a3] uppercase tracking-wide mb-2 px-0.5">
            {formatDateLabel(dateKey)}
          </h3>
          <ul className="rounded-3xl border border-[#e8e8e8] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden divide-y divide-[#f0f0f0]">
            {items.map(({ kind, data: t }) => {
              if (kind === 'openfinance') {
                const isCredit = t.type === 'CREDIT';
                const Icon =
                  categoryIconOpenFinance(t.category) || (isCredit ? ArrowDownLeft : ArrowUpRight);
                const colorClass = isCredit ? 'text-emerald-600' : 'text-red-600';
                const bgClass = isCredit ? 'bg-emerald-50' : 'bg-red-50';
                const ofAmount = Math.abs(Number(t.amount));
                return (
                  <li key={`of-${t.id}`} className="bg-white">
                    <div className="flex items-center gap-3 px-3 py-3.5">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${bgClass}`}>
                        <Icon className={`h-5 w-5 ${colorClass}`} aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[#111] text-[15px] leading-snug truncate">
                          {t.description || 'Sem descrição'}
                        </p>
                        <p className="text-xs text-[#888] truncate mt-0.5">
                          {[t.category, t.account_name].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {calcDock && Number.isFinite(ofAmount) && ofAmount > 0 && (
                          <div
                            className="flex items-center gap-0.5 mr-0.5"
                            onClick={(e) => e.stopPropagation()}
                            role="group"
                            aria-label="Enviar valor para a calculadora"
                          >
                            <button
                              type="button"
                              onClick={(e) =>
                                calcDock.appendAmount(ofAmount, '+', {
                                  flyFrom: { clientX: e.clientX, clientY: e.clientY },
                                  flyLabel: `${isCredit ? '+' : '−'}${formatMoneyAbs(t.amount)}`,
                                })
                              }
                              className="p-1.5 rounded-lg border border-[#e5e7eb] bg-white hover:bg-emerald-50 hover:border-emerald-200 active:scale-95"
                              title="Somar na calculadora"
                              aria-label="Somar na calculadora"
                            >
                              <Plus className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                            </button>
                            <button
                              type="button"
                              onClick={(e) =>
                                calcDock.appendAmount(ofAmount, '-', {
                                  flyFrom: { clientX: e.clientX, clientY: e.clientY },
                                  flyLabel: `${isCredit ? '+' : '−'}${formatMoneyAbs(t.amount)}`,
                                })
                              }
                              className="p-1.5 rounded-lg border border-[#e5e7eb] bg-white hover:bg-red-50 hover:border-red-200 active:scale-95"
                              title="Subtrair na calculadora"
                              aria-label="Subtrair na calculadora"
                            >
                              <Minus className="h-3.5 w-3.5 text-red-600" aria-hidden />
                            </button>
                          </div>
                        )}
                        {calcDock && Number.isFinite(ofAmount) && ofAmount > 0 ? (
                          <button
                            type="button"
                            className={`text-[15px] font-semibold tabular-nums ${colorClass} rounded-lg px-1.5 py-0.5 -mr-1 hover:bg-black/[0.05] active:scale-[0.98] cursor-pointer select-none text-left`}
                            title="Toque para somar na calculadora · Arraste até à calculadora"
                            aria-label={`Somar ${formatMoneyAbs(t.amount)} na calculadora`}
                            draggable
                            onDragStart={(e) => {
                              e.stopPropagation();
                              try {
                                e.dataTransfer.setData(
                                  CALC_DRAG_MIME,
                                  JSON.stringify({
                                    amount: ofAmount,
                                    sign: '+',
                                    flyLabel: `${isCredit ? '+' : '−'}${formatMoneyAbs(t.amount)}`,
                                  })
                                );
                                e.dataTransfer.effectAllowed = 'copy';
                              } catch {
                                /* ignore */
                              }
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              calcDock.appendAmount(ofAmount, '+', {
                                flyFrom: { clientX: e.clientX, clientY: e.clientY },
                                flyLabel: `${isCredit ? '+' : '−'}${formatMoneyAbs(t.amount)}`,
                              });
                            }}
                          >
                            {isCredit ? '+' : '−'}
                            {formatMoneyAbs(t.amount)}
                          </button>
                        ) : (
                          <span className={`text-[15px] font-semibold tabular-nums ${colorClass}`}>
                            {isCredit ? '+' : '−'}
                            {formatMoneyAbs(t.amount)}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setOpenFinanceDetail(pickOpenFinanceEssentialFields(t))}
                          className="p-2 rounded-full text-[#999] hover:bg-[#f3f4f6] hover:text-[#333]"
                          title="Resumo do movimento no banco"
                          aria-label="Ver resumo do banco"
                        >
                          <Info className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              }

              const transaction = t;
              const total = Number(transaction.total) || 0;
              const isIncome = total < 0;
              const displayValue = Math.abs(total);
              const rawName =
                (transaction.estabelecimento && String(transaction.estabelecimento).trim()) || 'Local não informado';
              const nomeLoja = resolveMerchantDisplayName(userId, rawName);
              const produtos = transaction.produtos || [];
              const numItens = Array.isArray(produtos) ? produtos.length : 0;
              const showConfirm = confirmId === transaction.id;
              const isDeleting = deletingId === transaction.id;
              const isEditing = editingId === transaction.id;
              const isNew = isTransactionNew(transaction);
              const IconFm = getFinMemoryCategoryIcon(transaction.categoria, transaction.estabelecimento);
              const iconBg = getCategoryColor(transaction.categoria, transaction.estabelecimento).main;

              return (
                <li key={`fm-${transaction.id}`} className="bg-white">
                  <div
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !isEditing) router.push(`/transaction/${transaction.id}`);
                    }}
                    onClick={() => {
                      if (!isEditing) router.push(`/transaction/${transaction.id}`);
                    }}
                    className={cn(
                      'flex items-center gap-3 px-3 py-3.5 cursor-pointer active:bg-[#fafafa]',
                      isNew && !isEditing && 'shadow-[inset_0_0_0_2px_rgba(46,204,73,0.35)]'
                    )}
                  >
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 text-white"
                      style={{ backgroundColor: iconBg }}
                    >
                      <IconFm className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        {isEditing ? (
                          <div className="flex flex-1 items-center gap-2 min-w-0" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="flex-1 min-w-0 font-semibold text-[#111] text-[15px] px-2 py-1 rounded-lg border-2 border-[#2ECC49] bg-white"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveTitle(transaction);
                                if (e.key === 'Escape') cancelEdit();
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => saveTitle(transaction)}
                              disabled={savingId === transaction.id}
                              className="shrink-0 p-2 rounded-xl bg-[#2ECC49] text-white"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <p
                            className={cn(
                              'font-semibold text-[#111] text-[15px] leading-snug truncate flex-1 cursor-text',
                              isNew && 'font-bold'
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (userId) startEdit(transaction);
                            }}
                          >
                            {nomeLoja}
                          </p>
                        )}
                        <div
                          className="flex items-center gap-1 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                          role="group"
                        >
                          {calcDock && displayValue > 0 && (
                            <div className="flex items-center gap-0.5" role="group" aria-label="Enviar valor para a calculadora">
                              <button
                                type="button"
                                onClick={(e) =>
                                  calcDock.appendAmount(displayValue, '+', {
                                    flyFrom: { clientX: e.clientX, clientY: e.clientY },
                                    flyLabel: `${isIncome ? '+' : '−'}${formatCurrency(displayValue)}`,
                                  })
                                }
                                className="p-1.5 rounded-lg border border-[#e5e7eb] bg-white hover:bg-emerald-50 hover:border-emerald-200 active:scale-95"
                                title="Somar na calculadora"
                                aria-label="Somar na calculadora"
                              >
                                <Plus className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                              </button>
                              <button
                                type="button"
                                onClick={(e) =>
                                  calcDock.appendAmount(displayValue, '-', {
                                    flyFrom: { clientX: e.clientX, clientY: e.clientY },
                                    flyLabel: `${isIncome ? '+' : '−'}${formatCurrency(displayValue)}`,
                                  })
                                }
                                className="p-1.5 rounded-lg border border-[#e5e7eb] bg-white hover:bg-red-50 hover:border-red-200 active:scale-95"
                                title="Subtrair na calculadora"
                                aria-label="Subtrair na calculadora"
                              >
                                <Minus className="h-3.5 w-3.5 text-red-600" aria-hidden />
                              </button>
                            </div>
                          )}
                          {calcDock && displayValue > 0 ? (
                            <button
                              type="button"
                              className={cn(
                                'text-[15px] font-semibold tabular-nums shrink-0 whitespace-nowrap rounded-lg px-1.5 py-0.5 hover:bg-black/[0.05] active:scale-[0.98] cursor-pointer select-none text-left',
                                isIncome ? 'text-emerald-600' : 'text-red-600'
                              )}
                              title="Toque para somar na calculadora · Arraste até à calculadora"
                              aria-label={`Somar ${formatCurrency(displayValue)} na calculadora`}
                              draggable
                              onDragStart={(e) => {
                                e.stopPropagation();
                                try {
                                  e.dataTransfer.setData(
                                    CALC_DRAG_MIME,
                                    JSON.stringify({
                                      amount: displayValue,
                                      sign: '+',
                                      flyLabel: `${isIncome ? '+' : '−'}${formatCurrency(displayValue)}`,
                                    })
                                  );
                                  e.dataTransfer.effectAllowed = 'copy';
                                } catch {
                                  /* ignore */
                                }
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                calcDock.appendAmount(displayValue, '+', {
                                  flyFrom: { clientX: e.clientX, clientY: e.clientY },
                                  flyLabel: `${isIncome ? '+' : '−'}${formatCurrency(displayValue)}`,
                                });
                              }}
                            >
                              {isIncome ? '+' : '−'}
                              {formatCurrency(displayValue)}
                            </button>
                          ) : (
                            <span
                              className={cn(
                                'text-[15px] font-semibold tabular-nums shrink-0 whitespace-nowrap',
                                isIncome ? 'text-emerald-600' : 'text-red-600'
                              )}
                            >
                              {isIncome ? '+' : '−'}
                              {formatCurrency(displayValue)}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-[#888] truncate mt-0.5">
                        {[transaction.categoria, numItens > 0 ? `${numItens} itens` : null].filter(Boolean).join(' · ')}
                        {numItens === 0 ? ` · ${formatDateShort(transaction.data)}` : ''}
                      </p>
                    </div>
                  </div>
                  {userId && (
                    <div className="flex items-center justify-end gap-1 px-3 py-2 border-t border-[#f3f4f6] bg-[#fafafa] flex-wrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          shareWhatsAppSummary(transaction);
                        }}
                        className="p-2 rounded-xl text-[#25D366] hover:bg-[#dcfce7] flex items-center gap-1"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.884 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                        </svg>
                        <span className="text-xs font-medium">WhatsApp</span>
                      </button>
                      <Link
                        prefetch={false}
                        href={`/transaction/${transaction.id}/edit`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 rounded-xl text-[#666] hover:bg-[#e5e7eb]"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      {!showConfirm ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmId(transaction.id);
                          }}
                          className="p-2 rounded-xl text-[#666] hover:bg-red-50 hover:text-red-600"
                          disabled={isDeleting}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : (
                        <span className="flex items-center gap-2 text-xs">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(transaction.id);
                            }}
                            className="px-2 py-1 bg-red-600 text-white rounded-lg font-medium"
                          >
                            {isDeleting ? '...' : 'Excluir'}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmId(null);
                            }}
                            className="px-2 py-1 bg-gray-200 rounded-lg"
                          >
                            Cancelar
                          </button>
                        </span>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <Sheet open={!!openFinanceDetail} onOpenChange={(o) => !o && setOpenFinanceDetail(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl px-5 pb-10 pt-4 max-h-[80vh] overflow-y-auto">
          <SheetHeader className="mb-3">
            <SheetTitle className="text-base font-bold">Movimento no banco</SheetTitle>
            <p className="text-xs text-[#666] text-left">
              Campos essenciais do Open Finance (sem payload completo).
            </p>
          </SheetHeader>
          {openFinanceDetail ? (
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-[#888]">Data</dt>
                <dd className="text-[#111] font-medium mt-0.5">
                  {openFinanceDetail.date
                    ? new Date(`${openFinanceDetail.date}T12:00:00`).toLocaleDateString('pt-BR', {
                        weekday: 'long',
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                      })
                    : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-[#888]">Valor</dt>
                <dd
                  className={cn(
                    'text-lg font-semibold tabular-nums mt-0.5',
                    openFinanceDetail.isCredit ? 'text-emerald-600' : 'text-red-600'
                  )}
                >
                  {openFinanceDetail.amount != null && Number.isFinite(openFinanceDetail.amount)
                    ? `${openFinanceDetail.isCredit ? '+' : '−'}${formatMoneyAbs(openFinanceDetail.amount)}`
                    : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-[#888]">Descrição</dt>
                <dd className="text-[#111] mt-0.5 break-words">{openFinanceDetail.description || '—'}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-[#888]">Categoria</dt>
                <dd className="text-[#111] mt-0.5">{openFinanceDetail.category || '—'}</dd>
              </div>
            </dl>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
