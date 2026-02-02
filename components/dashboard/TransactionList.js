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
 * Clique leva ao detalhe da transação quando a rota existir.
 */
export function TransactionList({ transactions, className }) {
  if (!transactions || transactions.length === 0) {
    return (
      <div className={cn('text-center py-12', className)}>
        <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">Nenhuma transação ainda</h3>
        <p className="text-sm text-muted-foreground">
          Sincronize seu Gmail ou escaneie uma nota fiscal
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Histórico</h2>
        <span className="text-sm text-muted-foreground">
          {transactions.length} transação(ões)
        </span>
      </div>

      <div className="bg-card rounded-[24px] overflow-hidden">
        {transactions.map((transaction, index) => {
          const total = Number(transaction.total) || 0;
          const isIncome = total < 0;
          const displayValue = Math.abs(total);

          return (
            <div key={transaction.id}>
              <Link
                href={`/transaction/${transaction.id}`}
                className="w-full flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                  {getCategoryIcon(transaction.categoria, transaction.estabelecimento)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">
                    {transaction.estabelecimento || 'Estabelecimento'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(transaction.data)}
                  </p>
                </div>
                <div
                  className={cn(
                    'text-right font-medium',
                    isIncome ? 'text-accent' : 'text-foreground'
                  )}
                >
                  {isIncome ? '+' : '-'} {formatCurrency(displayValue)}
                </div>
              </Link>
              {index < transactions.length - 1 && (
                <div className="h-px bg-border mx-4" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
