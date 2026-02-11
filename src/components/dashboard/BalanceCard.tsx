import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface BalanceCardProps {
  balance: number;
  transactionCount: number;
  className?: string;
}

export function BalanceCard({ balance, transactionCount, className }: BalanceCardProps) {
  const [isVisible, setIsVisible] = useState(true);

  const formattedBalance = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(balance);

  return (
    <div className={cn("bg-card rounded-2xl card-shadow p-6", className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-muted-foreground text-sm">Total de gastos</span>
        <button
          type="button"
          onClick={() => setIsVisible(!isVisible)}
          className="p-2 rounded-full hover:bg-muted transition-colors"
          aria-label={isVisible ? "Ocultar saldo" : "Mostrar saldo"}
        >
          {isVisible ? (
            <Eye className="h-5 w-5 text-muted-foreground" />
          ) : (
            <EyeOff className="h-5 w-5 text-muted-foreground" />
          )}
        </button>
      </div>
      <div className="text-3xl md:text-4xl font-bold text-foreground leading-tight" aria-live="polite">
        {isVisible ? formattedBalance : "••••••"}
      </div>
      <p className="text-muted-foreground text-xs mt-2">
        {transactionCount} nota{transactionCount !== 1 ? "s" : ""} fiscal{transactionCount !== 1 ? "is" : ""}
      </p>
    </div>
  );
}
