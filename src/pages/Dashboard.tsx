import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePartnership } from "@/hooks/usePartnership";
import { supabase } from "@/integrations/supabase/client";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { BalanceCard } from "@/components/dashboard/BalanceCard";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { TransactionList } from "@/components/dashboard/TransactionList";
import { EditTransactionSheet } from "@/components/dashboard/EditTransactionSheet";
import { Camera, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { toast } from "sonner";

interface TransactionItem {
  descricao: string;
  quantidade: number;
  valor_total: number;
}

interface Transaction {
  id: string;
  user_id?: string;
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
  const [showPartner, setShowPartner] = useState(false);
  const { partnership, partnerProfile } = usePartnership();

  // Month filter
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [filterByMonth, setFilterByMonth] = useState(true);

  // Edit sheet
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editOpen, setEditOpen] = useState(false);

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
          user_id: t.user_id,
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

  // Filter transactions by month and optionally by owner
  const filteredTransactions = useMemo(() => {
    let filtered = transactions;
    if (filterByMonth) {
      filtered = filtered.filter((t) => t.data && t.data.startsWith(selectedMonth));
    }
    return filtered;
  }, [transactions, selectedMonth, filterByMonth]);

  // Separate own vs partner transactions
  const myTransactions = useMemo(() => 
    filteredTransactions.filter(t => t.user_id === user?.id || !t.user_id),
    [filteredTransactions, user]
  );

  const partnerTransactions = useMemo(() =>
    filteredTransactions.filter(t => t.user_id && t.user_id !== user?.id),
    [filteredTransactions, user]
  );

  const displayTransactions = showPartner ? partnerTransactions : myTransactions;

  const totalGasto = useMemo(() => {
    return displayTransactions.reduce((sum, t) => sum + t.total, 0);
  }, [displayTransactions]);

  const totalCasal = useMemo(() => {
    return filteredTransactions.reduce((sum, t) => sum + t.total, 0);
  }, [filteredTransactions]);

  const handleMonthChange = (delta: number) => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const monthLabel = useMemo(() => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const d = new Date(y, m - 1);
    return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }, [selectedMonth]);

  const handleSync = () => {
    setSyncing(true);
    setTimeout(() => {
      toast.info("Sincronização do Gmail requer configuração do Google OAuth");
      setSyncing(false);
    }, 2000);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setEditOpen(true);
  };

  const userName = profile.name || user?.email?.split("@")[0] || "Usuário";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-md mx-auto px-5 pb-24 pt-5">
        <DashboardHeader userName={userName} onSignOut={handleSignOut} />

        <BalanceCard
          balance={totalGasto}
          transactionCount={displayTransactions.length}
          className="mt-6 mb-2 animate-fade-in"
        />

        {/* Partner toggle */}
        {partnership?.status === "active" && (
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setShowPartner(false)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${!showPartner ? "gradient-primary text-primary-foreground" : "bg-card text-muted-foreground border border-border"}`}
            >
              Meus Gastos
            </button>
            <button
              onClick={() => setShowPartner(true)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 ${showPartner ? "gradient-primary text-primary-foreground" : "bg-card text-muted-foreground border border-border"}`}
            >
              <Users className="h-4 w-4" />
              {partnerProfile?.name || "Parceiro(a)"}
            </button>
          </div>
        )}

        {/* Couple total */}
        {partnership?.status === "active" && partnerTransactions.length > 0 && (
          <div className="bg-card rounded-2xl card-shadow px-4 py-3 mb-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total do casal</span>
            <span className="font-bold text-foreground">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalCasal)}
            </span>
          </div>
        )}

        {/* Month selector */}
        <div className="flex items-center justify-between bg-card rounded-2xl px-4 py-3 card-shadow mb-6">
          <button onClick={() => handleMonthChange(-1)} className="p-1 text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => setFilterByMonth(!filterByMonth)}
            className="text-sm font-semibold text-foreground capitalize"
          >
            {filterByMonth ? monthLabel : "Todo o histórico"}
          </button>
          <button onClick={() => handleMonthChange(1)} className="p-1 text-muted-foreground hover:text-foreground">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <QuickActions onSync={handleSync} syncing={syncing} className="mb-8" />

        {loading ? (
          <div className="space-y-4" aria-live="polite" aria-busy="true">
            <div className="bg-card rounded-2xl card-shadow p-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 py-4">
                  <div className="h-10 w-10 rounded-full bg-muted animate-pulse shrink-0" />
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="h-4 max-w-[75%] bg-muted rounded animate-pulse" />
                    <div className="h-3 max-w-[50%] bg-muted rounded animate-pulse" />
                  </div>
                  <div className="h-4 w-20 bg-muted rounded animate-pulse shrink-0" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <TransactionList
            transactions={displayTransactions}
            onEdit={showPartner ? undefined : handleEditTransaction}
          />
        )}
      </div>

      {/* FAB */}
      <a
        onClick={() => navigate("/add-receipt")}
        className="fixed bottom-6 right-5 w-16 h-16 rounded-full flex items-center justify-center card-shadow-lg hover:scale-110 active:scale-95 transition-transform z-10 gradient-primary text-primary-foreground cursor-pointer"
        title="Escanear Nota Fiscal"
      >
        <Camera className="h-7 w-7" />
      </a>

      <EditTransactionSheet
        transaction={editingTransaction}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={fetchTransactions}
      />
    </div>
  );
};

export default Dashboard;
