import { ShoppingBag, Pencil, Search } from "lucide-react";
import { InstitutionAvatar } from "../../../components/InstitutionAvatar";
import { resolveInstitutionAsset } from "../../../lib/resolveInstitutionAsset.js";
import { cn } from "@/lib/utils";

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

interface TransactionItem {
  descricao: string;
  quantidade: number;
  valor_total: number;
}

export interface TransactionRow {
  id: string;
  estabelecimento: string;
  data: string;
  total: number;
  categoria: string;
  forma_pagamento: string;
  items: TransactionItem[];
  source?: string | null;
  hora?: string | null;
  institution_name?: string | null;
  institution_logo_url?: string | null;
  institution_connector_id?: string | null;
  credit_institution_name?: string | null;
  credit_institution_logo_url?: string | null;
  custom_icon_url?: string | null;
}

interface TransactionListProps {
  transactions: TransactionRow[];
  className?: string;
  onEdit?: (transaction: TransactionRow) => void;
  /** When true, shows "no results" message instead of "no transactions yet" */
  emptyState?: "default" | "search";
}

export function TransactionList({
  transactions,
  className,
  onEdit,
  emptyState = "default",
}: TransactionListProps) {
  if (!transactions || transactions.length === 0) {
    if (emptyState === "search") {
      return (
        <div className={cn("text-center py-12", className)}>
          <Search className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">Nenhum resultado</h3>
          <p className="text-sm text-muted-foreground">
            Nenhuma transação encontrada para sua busca. Tente outro termo.
          </p>
        </div>
      );
    }
    return (
      <div className={cn("text-center py-12", className)}>
        <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">Nenhuma transação ainda</h3>
        <p className="text-sm text-muted-foreground">Sincronize seu Gmail ou escaneie uma nota fiscal</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Histórico</h2>
        <span className="text-sm text-muted-foreground">{transactions.length} transação(ões)</span>
      </div>

      <div className="bg-card rounded-2xl card-shadow overflow-hidden">
        {transactions.map((transaction, index) => {
          const total = Number(transaction.total) || 0;
          const asset = resolveInstitutionAsset(transaction as unknown as Record<string, unknown>);

          return (
            <div key={transaction.id}>
              <button
                type="button"
                onClick={() => onEdit?.(transaction)}
                className="w-full flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors text-left group"
              >
                <InstitutionAvatar
                  asset={asset}
                  size={40}
                  label={transaction.institution_name ?? transaction.estabelecimento}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate text-base">
                    {transaction.estabelecimento || "Estabelecimento"}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {(transaction.categoria || "Outros") + " · " + formatDate(transaction.data)}
                  </p>
                </div>
                <div className="text-right flex items-center gap-2">
                  <span className="font-bold text-base text-foreground">- {formatCurrency(total)}</span>
                  {onEdit && (
                    <Pencil className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </div>
              </button>
              {index < transactions.length - 1 && <div className="h-px bg-border mx-4" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
