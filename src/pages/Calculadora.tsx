import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { CalculadoraEconomia } from "@/components/CalculadoraEconomia";
import { BottomNav } from "@/components/BottomNav";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { useAuth } from "@/hooks/useAuth";

export default function CalculadoraPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const userName = user?.email?.split("@")[0] || "Usuário";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-md mx-auto px-5 pb-28 pt-5">
        <DashboardHeader userName={userName} onSignOut={signOut} />

        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>

        <CalculadoraEconomia />
      </div>
      <BottomNav />
    </div>
  );
}
