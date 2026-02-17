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
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { getCategoryColor } from '../../lib/colors';

const categoryIcons = {
  transporte: <Car className="h-5 w-5" />,
  uber: <Car className="h-5 w-5" />,
  supermercado: <ShoppingBag className="h-5 w-5" />,
  mercado: <ShoppingBag className="h-5 w-5" />,
  restaurante: <Utensils className="h-5 w-5" />,
  lanchonete: <Utensils className="h-5 w-5" />,
  alimentação: <Utensils className="h-5 w-5" />,
  combustível: <Fuel className="h-5 w-5" />,
  posto: <Fuel className="h-5 w-5" />,
  farmácia: <Pill className="h-5 w-5" />,
  eletrônicos: <Smartphone className="h-5 w-5" />,
  vestuário: <Shirt className="h-5 w-5" />,
  roupas: <Shirt className="h-5 w-5" />,
  serviços: <Wrench className="h-5 w-5" />,
  padaria: <Receipt className="h-5 w-5" />,
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
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold text-[#333]">Histórico</h2>
        <span className="text-sm text-[#666]">
          {transactions.length} transação(ões)
        </span>
      </div>
      <p className="text-xs text-[#666] mb-4">
        Toque em uma compra para ver <strong>preços e produtos</strong> que você pagou.
      </p>

      <div className="card-lovable overflow-hidden divide-y divide-[#e5e7eb]">
        {transactions.map((transaction) => {
          const total = Number(transaction.total) || 0;
          const isIncome = total < 0;
          const displayValue = Math.abs(total);
          const nomeLoja = (transaction.estabelecimento && String(transaction.estabelecimento).trim()) || 'Local não informado';
          const produtos = transaction.produtos || [];
          const numItens = Array.isArray(produtos) ? produtos.length : 0;

          const showConfirm = confirmId === transaction.id;
          const isDeleting = deletingId === transaction.id;

          return (
            <div key={transaction.id} className="bg-white">
              <Link href={`/transaction/${transaction.id}`} className="block active:bg-[#f8f9fa]">
                <div className="flex gap-3 p-4 sm:p-4">
                  {/* Ícone por categoria */}
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-white flex-shrink-0"
                    style={{ backgroundColor: getCategoryColor(transaction.categoria, transaction.estabelecimento).main }}
                  >
                    {getCategoryIcon(transaction.categoria, transaction.estabelecimento)}
                  </div>

                  {/* Nome da loja em destaque + valor na mesma linha */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-[#111] text-base sm:text-lg leading-snug line-clamp-2">
                        {nomeLoja}
                      </h3>
                      <span
                        className={cn(
                          'font-bold text-base shrink-0 whitespace-nowrap',
                          isIncome ? 'text-[#16a34a]' : 'text-[#333]'
                        )}
                      >
                        {isIncome ? '+' : '−'} {formatCurrency(displayValue)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-sm text-[#666]">
                        {formatDate(transaction.data)}
                      </span>
                      {numItens > 0 && (
                        <span className="text-xs text-[#2ECC49] font-medium">
                          {numItens} {numItens === 1 ? 'item' : 'itens'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>

              {/* Ações: Editar e Excluir em linha separada para não apertar no mobile */}
              {userId && (
                <div className="flex items-center justify-end gap-1 px-4 pb-3 pt-0">
                  <Link
                    href={`/transaction/${transaction.id}/edit`}
                    className="p-2.5 rounded-xl text-[#666] hover:bg-[#e5e7eb] hover:text-[#333] transition-colors"
                    title="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </Link>
                  {!showConfirm ? (
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmId(transaction.id); }}
                      className="p-2.5 rounded-xl text-[#666] hover:bg-red-50 hover:text-red-600 transition-colors"
                      title="Excluir"
                      disabled={isDeleting}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : (
                    <span className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(transaction.id); }}
                        className="px-3 py-1.5 bg-red-600 text-white rounded-lg font-medium"
                      >
                        {isDeleting ? '...' : 'Excluir'}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmId(null); }}
                        className="px-3 py-1.5 bg-gray-200 text-gray-800 rounded-lg font-medium"
                      >
                        Cancelar
                      </button>
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
