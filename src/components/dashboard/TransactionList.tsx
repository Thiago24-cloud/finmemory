import {
  Car, ShoppingBag, Utensils, Fuel, Pill, Smartphone, Shirt, Wrench, Receipt, Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";

const categoryIcons: Record<string, React.ReactNode> = {
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

function getCategoryIcon(category: string, merchant: string) {
  const lowerCategory = (category || "").toLowerCase();
  const lowerMerchant = (merchant || "").toLowerCase();
  for (const [key, icon] of Object.entries(categoryIcons)) {
    if (lowerCategory.includes(key) || lowerMerchant.includes(key)) return icon;
  }
  return <Receipt className="h-5 w-5" />;
}

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  } catch {
    return dateStr;
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

interface Transaction {
  id: string;
  estabelecimento: string;
  data: string;
  total: number;
  categoria: string;
  forma_pagamento: string;
  items: any[];
}

interface TransactionListProps {
  transactions: Transaction[];
  className?: string;
  onEdit?: (transaction: Transaction) => void;
}

export function TransactionList({ transactions, className, onEdit }: TransactionListProps) {
  if (!transactions || transactions.length === 0) {
    return (
      <div className={cn("text-center py-12", className)}>
        <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">Nenhuma transação ainda</h3>
        <p className="text-sm text-muted-foreground">
          Sincronize seu Gmail ou escaneie uma nota fiscal
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Histórico</h2>
        <span className="text-sm text-muted-foreground">
          {transactions.length} transação(ões)
        </span>
      </div>

      <div className="bg-card rounded-2xl card-shadow overflow-hidden">
        {transactions.map((transaction, index) => {
          const total = Number(transaction.total) || 0;

          return (
            <div key={transaction.id}>
              <button
                type="button"
                onClick={() => onEdit?.(transaction)}
                className="w-full flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors text-left group"
              >
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                  {getCategoryIcon(transaction.categoria, transaction.estabelecimento)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate text-base">
                    {transaction.estabelecimento || "Estabelecimento"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(transaction.data)}
                  </p>
                </div>
                <div className="text-right flex items-center gap-2">
                  <span className="font-bold text-base text-foreground">
                    - {formatCurrency(total)}
                  </span>
                  {onEdit && (
                    <Pencil className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </div>
              </button>
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
