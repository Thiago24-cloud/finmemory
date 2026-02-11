import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import TransactionCard from "@/components/TransactionCard";

const mockTransactions = [
  {
    id: "1",
    estabelecimento: "Supermercado Extra",
    data: "2025-02-10",
    total: 187.45,
    categoria: "Alimentação",
    forma_pagamento: "Cartão de Crédito",
    items: [
      { descricao: "Arroz 5kg", quantidade: 1, valor_total: 24.9 },
      { descricao: "Feijão 1kg", quantidade: 2, valor_total: 15.8 },
      { descricao: "Leite Integral", quantidade: 6, valor_total: 35.4 },
      { descricao: "Outros itens", quantidade: 8, valor_total: 111.35 },
    ],
  },
  {
    id: "2",
    estabelecimento: "Farmácia Pacheco",
    data: "2025-02-08",
    total: 54.9,
    categoria: "Saúde",
    forma_pagamento: "PIX",
    items: [
      { descricao: "Dipirona 500mg", quantidade: 1, valor_total: 12.9 },
      { descricao: "Vitamina C", quantidade: 1, valor_total: 42.0 },
    ],
  },
  {
    id: "3",
    estabelecimento: "Posto Shell",
    data: "2025-02-05",
    total: 250.0,
    categoria: "Transporte",
    forma_pagamento: "Cartão de Débito",
    items: [
      { descricao: "Gasolina Aditivada", quantidade: 1, valor_total: 250.0 },
    ],
  },
];

const Dashboard = () => {
  const navigate = useNavigate();
  const [syncing, setSyncing] = useState(false);
  const [transactions] = useState(mockTransactions);

  const handleSync = () => {
    setSyncing(true);
    setTimeout(() => setSyncing(false), 2000);
  };

  const totalGasto = transactions.reduce((sum, t) => sum + t.total, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="gradient-primary px-4 py-5">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-primary-foreground">🚀 FinMemory</h1>
            <p className="text-primary-foreground/70 text-sm">Olá, Usuário</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-primary-foreground/30 text-primary-foreground bg-transparent hover:bg-primary-foreground/10"
            onClick={() => navigate("/")}
          >
            Desconectar
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 space-y-6">
        {/* Summary Card */}
        <div className="bg-card rounded-2xl card-shadow p-6 animate-fade-in">
          <p className="text-sm text-muted-foreground mb-1">Total de gastos</p>
          <p className="text-3xl font-bold text-foreground">
            R$ {totalGasto.toFixed(2).replace(".", ",")}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {transactions.length} nota{transactions.length !== 1 ? "s" : ""} fiscal{transactions.length !== 1 ? "is" : ""}
          </p>
        </div>

        {/* Sync */}
        <Button
          className="w-full gradient-primary text-primary-foreground font-semibold py-5 rounded-xl"
          onClick={handleSync}
          disabled={syncing}
        >
          {syncing ? (
            <span className="animate-pulse-soft">⏳ Buscando notas fiscais...</span>
          ) : (
            "🔄 Buscar Notas Fiscais do Gmail"
          )}
        </Button>

        {/* Transactions */}
        <div className="space-y-3">
          <h2 className="font-bold text-foreground text-lg">Suas Notas Fiscais</h2>
          {transactions.length === 0 ? (
            <div className="bg-card rounded-2xl card-shadow p-8 text-center">
              <p className="text-4xl mb-3">📭</p>
              <p className="text-muted-foreground">Nenhuma nota fiscal encontrada</p>
              <p className="text-sm text-muted-foreground mt-1">
                Clique em "Buscar Notas Fiscais" para sincronizar
              </p>
            </div>
          ) : (
            transactions.map((t, i) => (
              <div key={t.id} className="animate-slide-up" style={{ animationDelay: `${i * 100}ms` }}>
                <TransactionCard transaction={t} />
              </div>
            ))
          )}
        </div>
      </main>

      {/* FAB */}
      <button
        onClick={() => navigate("/add-receipt")}
        className="fixed bottom-6 right-6 w-16 h-16 rounded-full gradient-primary text-primary-foreground text-2xl card-shadow-lg flex items-center justify-center hover:scale-105 transition-transform active:scale-95 z-50"
        aria-label="Adicionar nota fiscal"
      >
        📸
      </button>
    </div>
  );
};

export default Dashboard;
