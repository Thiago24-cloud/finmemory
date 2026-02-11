import { useState } from "react";

interface Item {
  descricao: string;
  quantidade: number;
  valor_total: number;
}

interface Transaction {
  id: string;
  estabelecimento: string;
  data: string;
  total: number;
  categoria: string;
  forma_pagamento: string;
  items: Item[];
}

const categoryEmoji: Record<string, string> = {
  Alimentação: "🛒",
  Saúde: "💊",
  Transporte: "⛽",
  Lazer: "🎮",
  Educação: "📚",
  Outros: "📦",
};

const TransactionCard = ({ transaction }: { transaction: Transaction }) => {
  const [expanded, setExpanded] = useState(false);

  const formatDate = (d: string) => {
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  };

  return (
    <div
      className="bg-card rounded-2xl card-shadow overflow-hidden cursor-pointer hover:card-shadow-lg transition-shadow"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="p-4 flex items-center gap-4">
        <span className="text-2xl flex-shrink-0">
          {categoryEmoji[transaction.categoria] || "📦"}
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate">{transaction.estabelecimento}</h3>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            <span>{formatDate(transaction.data)}</span>
            <span>•</span>
            <span>{transaction.forma_pagamento}</span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-bold text-foreground">
            R$ {transaction.total.toFixed(2).replace(".", ",")}
          </p>
          <span className="text-xs text-muted-foreground">{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-border animate-fade-in">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-3 mb-2">
            Itens
          </p>
          <div className="space-y-1.5">
            {transaction.items.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-foreground">
                  {item.quantidade}x {item.descricao}
                </span>
                <span className="text-muted-foreground font-medium">
                  R$ {item.valor_total.toFixed(2).replace(".", ",")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionCard;
