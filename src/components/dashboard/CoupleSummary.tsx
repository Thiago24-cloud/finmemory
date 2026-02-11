import { useMemo } from "react";
import { Users, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface Transaction {
  id: string;
  user_id?: string;
  estabelecimento: string;
  data: string;
  total: number;
  categoria: string;
  forma_pagamento: string;
  items: any[];
}

interface CoupleSummaryProps {
  myTransactions: Transaction[];
  partnerTransactions: Transaction[];
  userName: string;
  partnerName: string;
  className?: string;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function CoupleSummary({
  myTransactions,
  partnerTransactions,
  userName,
  partnerName,
  className,
}: CoupleSummaryProps) {
  const allTransactions = useMemo(
    () => [...myTransactions, ...partnerTransactions],
    [myTransactions, partnerTransactions]
  );

  const myTotal = useMemo(() => myTransactions.reduce((s, t) => s + t.total, 0), [myTransactions]);
  const partnerTotal = useMemo(() => partnerTransactions.reduce((s, t) => s + t.total, 0), [partnerTransactions]);
  const coupleTotal = myTotal + partnerTotal;

  // Category breakdown per person
  const categoryData = useMemo(() => {
    const cats = new Map<string, { my: number; partner: number }>();

    myTransactions.forEach((t) => {
      const cat = t.categoria || "Outros";
      const entry = cats.get(cat) ?? { my: 0, partner: 0 };
      entry.my += t.total;
      cats.set(cat, entry);
    });

    partnerTransactions.forEach((t) => {
      const cat = t.categoria || "Outros";
      const entry = cats.get(cat) ?? { my: 0, partner: 0 };
      entry.partner += t.total;
      cats.set(cat, entry);
    });

    return Array.from(cats.entries())
      .map(([category, vals]) => ({
        category,
        my: vals.my,
        partner: vals.partner,
        total: vals.my + vals.partner,
      }))
      .sort((a, b) => b.total - a.total);
  }, [myTransactions, partnerTransactions]);

  const maxCategoryValue = useMemo(
    () => Math.max(...categoryData.map((c) => Math.max(c.my, c.partner)), 1),
    [categoryData]
  );

  if (allTransactions.length === 0) return null;

  const myPercentage = coupleTotal > 0 ? (myTotal / coupleTotal) * 100 : 50;

  return (
    <div className={cn("space-y-4 animate-fade-in", className)}>
      {/* Couple overview card */}
      <div className="bg-card rounded-2xl card-shadow p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center">
            <Users className="h-4 w-4 text-primary-foreground" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Resumo do Casal</h3>
        </div>

        {/* Total */}
        <p className="text-2xl font-bold text-foreground mb-4">{formatCurrency(coupleTotal)}</p>

        {/* Split bar */}
        <div className="h-3 bg-muted rounded-full overflow-hidden flex mb-2">
          <div
            className="h-full gradient-primary rounded-l-full transition-all duration-500"
            style={{ width: `${myPercentage}%` }}
          />
          <div
            className="h-full bg-secondary rounded-r-full transition-all duration-500"
            style={{ width: `${100 - myPercentage}%` }}
          />
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm gradient-primary inline-block" />
            {userName} · {formatCurrency(myTotal)}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-secondary inline-block" />
            {partnerName} · {formatCurrency(partnerTotal)}
          </span>
        </div>

        {/* Who spent more */}
        <div className="mt-3 flex items-center gap-1.5 text-xs">
          {myTotal > partnerTotal ? (
            <>
              <TrendingUp className="h-3.5 w-3.5 text-destructive" />
              <span className="text-muted-foreground">
                {userName} gastou{" "}
                <span className="font-semibold text-foreground">
                  {formatCurrency(myTotal - partnerTotal)}
                </span>{" "}
                a mais
              </span>
            </>
          ) : partnerTotal > myTotal ? (
            <>
              <TrendingDown className="h-3.5 w-3.5 text-accent" />
              <span className="text-muted-foreground">
                {partnerName} gastou{" "}
                <span className="font-semibold text-foreground">
                  {formatCurrency(partnerTotal - myTotal)}
                </span>{" "}
                a mais
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">Gastos iguais! 🎉</span>
          )}
        </div>
      </div>

      {/* Category comparison chart */}
      {categoryData.length > 0 && (
        <div className="bg-card rounded-2xl card-shadow p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">
            Gastos por Categoria
          </h3>
          <div className="space-y-4">
            {categoryData.map((cat) => (
              <div key={cat.category} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">{cat.category}</span>
                  <span className="text-muted-foreground">{formatCurrency(cat.total)}</span>
                </div>
                {/* My bar */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-16 truncate text-right">
                    {userName}
                  </span>
                  <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full gradient-primary rounded-full transition-all duration-500"
                      style={{ width: `${(cat.my / maxCategoryValue) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground w-16 tabular-nums">
                    {formatCurrency(cat.my)}
                  </span>
                </div>
                {/* Partner bar */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-16 truncate text-right">
                    {partnerName}
                  </span>
                  <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-secondary rounded-full transition-all duration-500"
                      style={{ width: `${(cat.partner / maxCategoryValue) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground w-16 tabular-nums">
                    {formatCurrency(cat.partner)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
