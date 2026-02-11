import * as React from "react";
import { cn } from "@/lib/utils";
import { Trash2 } from "lucide-react";

export interface TransactionRowProps {
  /** Transaction ID */
  id: string;
  /** Store/merchant name */
  estabelecimento: string;
  /** Date string (YYYY-MM-DD) */
  data: string;
  /** Total amount */
  total: number;
  /** Optional emoji/icon */
  icon?: React.ReactNode;
  /** Delete handler */
  onDelete?: (id: string) => void;
  /** Additional class names */
  className?: string;
}

/**
 * TransactionRow – Compact transaction line for lists and tables.
 */
const TransactionRow = ({
  id,
  estabelecimento,
  data,
  total,
  icon,
  onDelete,
  className,
}: TransactionRowProps) => {
  const formatDate = (d: string) => {
    const parts = d.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return d;
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 py-3 px-4 bg-card rounded-xl hover:bg-muted/50 transition-colors group",
        className
      )}
    >
      {icon && <span className="text-xl flex-shrink-0">{icon}</span>}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{estabelecimento}</p>
        <p className="text-xs text-muted-foreground">{formatDate(data)}</p>
      </div>
      <span className="text-sm font-bold text-foreground whitespace-nowrap">
        R$ {total.toFixed(2).replace(".", ",")}
      </span>
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(id);
          }}
          className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive/80 transition-opacity p-1"
          aria-label="Excluir transação"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

export default TransactionRow;
