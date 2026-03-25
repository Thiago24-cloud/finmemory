import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { BottomNav } from "@/components/BottomNav";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { CobrancasMiniCard } from "@/components/dashboard/CobrancasMiniCard";
import { Button } from "@/components/ui/button";

export default function Contas() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const selectedMonth = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const userName = user?.email?.split("@")[0] || "Usuário";

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-md mx-auto px-5 pb-28 pt-5">
        <DashboardHeader userName={userName} onSignOut={handleSignOut} />

        <Button
          type="button"
          variant="outline"
          className="w-full mb-4"
          onClick={() => navigate("/calculadora")}
        >
          Calculadora de economia
        </Button>

        <CobrancasMiniCard selectedMonth={selectedMonth} />
      </div>

      <BottomNav />
    </div>
  );
}

