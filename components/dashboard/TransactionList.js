import { useState } from 'react';
import Link from 'next/link';
import {
  Car,
  ShoppingBag,
  Utensils,
  Fuel,
  Pill,
  Smartphone,
  Shirt,
  Wrench,
  Receipt,
  Pencil,
  Trash2,
  MapPin,
} from 'lucide-react';
import { cn } from '../../lib/utils';

const categoryIcons = {
  transporte: <Car className="h-5 w-5" />,
  uber: <Car className="h-5 w-5" />,
  supermercado: <ShoppingBag className="h-5 w-5" />,
  mercado: <ShoppingBag className="h-5 w-5" />,
  restaurante: <Utensils className="h-5 w-5" />,
  alimentação: <Utensils className="h-5 w-5" />,
  combustível: <Fuel className="h-5 w-5" />,
  posto: <Fuel className="h-5 w-5" />,
  farmácia: <Pill className="h-5 w-5" />,
  eletrônicos: <Smartphone className="h-5 w-5" />,
  vestuário: <Shirt className="h-5 w-5" />,
  serviços: <Wrench className="h-5 w-5" />,
};

function getCategoryIcon(category, merchant) {
  const lowerCategory = (category || '').toLowerCase();
  const lowerMerchant = (merchant || '').toLowerCase();
  for (const [key, icon] of Object.entries(categoryIcons)) {
    if (lowerCategory.includes(key) || lowerMerchant.includes(key)) return icon;
  }
  return <Receipt className="h-5 w-5" />;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  } catch {
    return dateStr;
  }
}

function formatCurrency(value) {
  if (value == null) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

/**
 * Lista de transações – dados reais do Supabase (transacoes + produtos).
 * Editar: link para /transaction/[id]/edit. Deletar: botão com confirmação, chama onDeleted após sucesso.
 */
export function TransactionList({ transactions, userId, onDeleted, className }) {
  const [deletingId, setDeletingId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  const handleDelete = async (id) => {
    if (!userId || !onDeleted) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/transactions/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
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

  if (!transactions || transactions.length === 0) {
    return (
      <div className={cn('text-center py-12', className)}>
        <ShoppingBag className="h-16 w-16 mx-auto text-[#999] mb-4" />
        <h3 className="text-lg font-medium text-[#333] mb-2">Nenhuma transação ainda</h3>
        <p className="text-sm text-[#666]">
          Sincronize seu Gmail ou escaneie uma nota fiscal
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[#333]">Histórico</h2>
        <span className="text-sm text-[#666]">
          {transactions.length} transação(ões)
        </span>
      </div>

      <div className="card-lovable overflow-hidden">
        {transactions.map((transaction, index) => {
          const total = Number(transaction.total) || 0;
          const isIncome = total < 0;
          const displayValue = Math.abs(total);
          const onde = transaction.estabelecimento?.trim() || 'Local não informado';

          const showConfirm = confirmId === transaction.id;
          const isDeleting = deletingId === transaction.id;

          return (
            <div key={transaction.id}>
              <div className="w-full flex items-center gap-3 p-4 hover:bg-[#f8f9fa] transition-colors">
                <div className="w-11 h-11 rounded-xl bg-[#f8f9fa] flex items-center justify-center text-[#666] shrink-0">
                  {getCategoryIcon(transaction.categoria, transaction.estabelecimento)}
                </div>
                <Link href={`/transaction/${transaction.id}`} className="flex-1 min-w-0 text-left">
                  <p className="text-xs text-[#888] uppercase tracking-wide flex items-center gap-1 mb-0.5">
                    <MapPin className="h-3.5 w-3" /> Onde
                  </p>
                  <p className="font-semibold text-[#333] text-base leading-tight truncate">
                    {onde}
                  </p>
                  <p className="text-sm text-[#666] mt-0.5">
                    {formatDate(transaction.data)}
                  </p>
                </Link>
                <div
                  className={cn(
                    'text-right font-bold text-base shrink-0',
                    isIncome ? 'text-[#28a745]' : 'text-[#333]'
                  )}
                >
                  {isIncome ? '+' : '-'} {formatCurrency(displayValue)}
                </div>
                {userId && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Link
                      href={`/transaction/${transaction.id}/edit`}
                      className="p-2 rounded-lg text-[#666] hover:bg-[#e5e7eb] hover:text-[#333]"
                      title="Editar"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Pencil className="h-4 w-4" />
                    </Link>
                    {!showConfirm ? (
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); setConfirmId(transaction.id); }}
                        className="p-2 rounded-lg text-[#666] hover:bg-red-50 hover:text-red-600"
                        title="Deletar"
                        disabled={isDeleting}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : (
                      <span className="flex items-center gap-1 text-xs">
                        <button
                          type="button"
                          onClick={() => handleDelete(transaction.id)}
                          className="px-2 py-1 bg-red-600 text-white rounded font-medium"
                        >
                          {isDeleting ? '...' : 'Sim'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmId(null)}
                          className="px-2 py-1 bg-gray-200 text-gray-800 rounded font-medium"
                        >
                          Não
                        </button>
                      </span>
                    )}
                  </div>
                )}
              </div>
              {index < transactions.length - 1 && (
                <div className="h-px bg-[#e5e7eb] mx-4" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
