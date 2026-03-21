import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { BottomNav } from "@/components/BottomNav";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { CalculatorMini } from "@/components/dashboard/CalculatorMini";
import { CobrancasMiniCard } from "@/components/dashboard/CobrancasMiniCard";

export default function Contas() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const selectedMonth = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const [calcBase, setCalcBase] = useState<number>(0);
  const [unpaidChargesTotal, setUnpaidChargesTotal] = useState<number>(0);
  const [calcBaseTouched, setCalcBaseTouched] = useState(false);

  useEffect(() => {
    // Mantem base em branco por padrao. Se quiser, a gente puxa o saldo do mes aqui depois.
    setCalcBaseTouched(false);
  }, [selectedMonth]);

  const userName = user?.email?.split("@")[0] || "Usuário";

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-md mx-auto px-5 pb-28 pt-5">
        <DashboardHeader userName={userName} onSignOut={handleSignOut} />

        <CalculatorMini
          baseValue={calcBase}
          onBaseValueChange={(v) => {
            setCalcBaseTouched(true);
            setCalcBase(v);
          }}
        />

        <div className="mt-1 mb-3 text-xs text-muted-foreground">
          Sobra apos cobrancas nao pagas:{" "}
          <span className="font-semibold text-foreground">
            {(calcBase - unpaidChargesTotal).toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </span>
        </div>

        <CobrancasMiniCard
          selectedMonth={selectedMonth}
          onUnpaidTotalChange={setUnpaidChargesTotal}
        />
      </div>

      <BottomNav />
    </div>
  );
}

