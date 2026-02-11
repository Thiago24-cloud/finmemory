import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import TransactionCard from "@/components/TransactionCard";
import { toast } from "sonner";

interface TransactionItem {
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
  items: TransactionItem[];
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ name: string | null }>({ name: null });

  useEffect(() => {
    fetchProfile();
    fetchTransactions();
  }, []);

  const fetchProfile = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("name")
      .eq("user_id", user!.id)
      .single();
    if (data) setProfile(data);
  };

  const fetchTransactions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("transacoes")
      .select("*")
      .order("data", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar transações");
    } else {
      setTransactions(
        (data || []).map((t: any) => ({
          id: t.id,
          estabelecimento: t.estabelecimento,
          data: t.data || "",
          total: Number(t.total),
          categoria: t.categoria || "Outros",
          forma_pagamento: t.forma_pagamento || "",
          items: Array.isArray(t.items) ? t.items : [],
        }))
      );
    }
    setLoading(false);
  };

  const handleSync = () => {
    setSyncing(true);
    toast.info("Sincronização do Gmail requer configuração do Google OAuth");
    setTimeout(() => setSyncing(false), 2000);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const totalGasto = transactions.reduce((sum, t) => sum + t.total, 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-primary px-4 py-5">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-primary-foreground">🚀 FinMemory</h1>
            <p className="text-primary-foreground/70 text-sm">
              Olá, {profile.name || user?.email?.split("@")[0]}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-primary-foreground/30 text-primary-foreground bg-transparent hover:bg-primary-foreground/10"
            onClick={handleSignOut}
          >
            Desconectar
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 space-y-6">
        <div className="bg-card rounded-2xl card-shadow p-6 animate-fade-in">
          <p className="text-sm text-muted-foreground mb-1">Total de gastos</p>
          <p className="text-3xl font-bold text-foreground">
            R$ {totalGasto.toFixed(2).replace(".", ",")}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {transactions.length} nota{transactions.length !== 1 ? "s" : ""} fiscal{transactions.length !== 1 ? "is" : ""}
          </p>
        </div>

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

        <div className="space-y-3">
          <h2 className="font-bold text-foreground text-lg">Suas Notas Fiscais</h2>
          {loading ? (
            <div className="bg-card rounded-2xl card-shadow p-8 text-center">
              <p className="text-muted-foreground animate-pulse-soft">Carregando...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="bg-card rounded-2xl card-shadow p-8 text-center">
              <p className="text-4xl mb-3">📭</p>
              <p className="text-muted-foreground">Nenhuma nota fiscal encontrada</p>
              <p className="text-sm text-muted-foreground mt-1">
                Use o botão 📸 para adicionar uma nota fiscal
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
