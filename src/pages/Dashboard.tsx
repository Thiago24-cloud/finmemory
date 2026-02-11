import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { BalanceCard } from "@/components/dashboard/BalanceCard";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { TransactionList } from "@/components/dashboard/TransactionList";
import { Camera } from "lucide-react";
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

interface SyncLog {
  type: "info" | "success" | "warning" | "error";
  message: string;
  timestamp: Date;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ name: string | null }>({ name: null });
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);

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
    setSyncLogs([{ type: "info", message: "🔄 Iniciando sincronização...", timestamp: new Date() }]);
    setShowLogs(true);

    // Gmail sync requires Google OAuth configuration
    setTimeout(() => {
      setSyncLogs((prev) => [
        ...prev,
        { type: "warning", message: "⚠️ Sincronização do Gmail requer configuração do Google OAuth", timestamp: new Date() },
      ]);
      toast.info("Sincronização do Gmail requer configuração do Google OAuth");
      setSyncing(false);
    }, 2000);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const totalGasto = useMemo(() => {
    return transactions.reduce((sum, t) => sum + t.total, 0);
  }, [transactions]);

  const userName = profile.name || user?.email?.split("@")[0] || "Usuário";

  const logTypeStyles: Record<string, string> = {
    info: "bg-blue-50 border-l-blue-300 text-blue-800",
    success: "bg-green-50 border-l-green-300 text-green-800",
    warning: "bg-yellow-50 border-l-yellow-300 text-yellow-800",
    error: "bg-red-50 border-l-red-300 text-red-800",
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-md mx-auto px-5 pb-24 pt-5">
        <DashboardHeader
          userName={userName}
          onSignOut={handleSignOut}
        />

        <BalanceCard
          balance={totalGasto}
          transactionCount={transactions.length}
          className="mt-6 mb-6 animate-fade-in"
        />

        <QuickActions
          onSync={handleSync}
          syncing={syncing}
          className="mb-8"
        />

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
          <TransactionList transactions={transactions} />
        )}

        {/* Sync Logs Panel */}
        {syncLogs.length > 0 && !showLogs && (
          <button
            type="button"
            onClick={() => setShowLogs(true)}
            className="mt-4 px-4 py-2 bg-muted text-foreground border border-border rounded-xl text-sm font-medium"
          >
            📋 Ver Logs
          </button>
        )}

        {showLogs && syncLogs.length > 0 && (
          <div className="bg-card rounded-2xl p-5 mt-6 card-shadow max-h-[400px] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-foreground">📋 Logs da Sincronização</h3>
              <button
                type="button"
                onClick={() => setShowLogs(false)}
                className="bg-muted border-none rounded-lg py-2 px-4 cursor-pointer text-sm font-bold text-muted-foreground hover:bg-border transition-colors"
              >
                ✕ Fechar
              </button>
            </div>
            <div className="font-mono text-[13px] leading-relaxed">
              {syncLogs.map((log, index) => (
                <div
                  key={index}
                  className={`${logTypeStyles[log.type] || logTypeStyles.info} border-l-4 py-2.5 px-3.5 mb-2 rounded overflow-hidden flex justify-between items-center`}
                >
                  <span>{log.message}</span>
                  <span className="text-[11px] text-muted-foreground ml-3">
                    {log.timestamp.toLocaleTimeString("pt-BR")}
                  </span>
                </div>
              ))}
            </div>
          </div>
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
    </div>
  );
};

export default Dashboard;
