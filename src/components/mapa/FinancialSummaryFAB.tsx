import { AnimatePresence, motion } from "framer-motion";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useShopping } from "@/context/ShoppingProvider";

function formatCurrency(value: number) {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

type Props = {
  convenienceSavingsGap: number;
  showConvenienceNudge: boolean;
};

export function FinancialSummaryFAB({
  convenienceSavingsGap,
  showConvenienceNudge,
}: Props) {
  const {
    financialSummary,
    setScannerInsightOpen,
    scannerInsightOpen,
    selectedDecision,
  } = useShopping();

  return (
    <>
      <AnimatePresence>
        {selectedDecision === "convenience" && showConvenienceNudge && convenienceSavingsGap > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="absolute bottom-32 left-4 right-4 z-20 rounded-xl border border-[#39FF14]/25 bg-black/55 px-4 py-3 backdrop-blur-[10px]"
          >
            <p className="text-sm text-white/90">
              Sua meta mensal agradeceria se você economizasse esses{" "}
              {formatCurrency(convenienceSavingsGap)} hoje.
            </p>
            <button type="button" className="text-xs text-[#39FF14] mt-1 font-medium">
              Ver análise de gastos completa
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {scannerInsightOpen && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="absolute bottom-32 left-4 right-4 z-20 rounded-2xl border border-white/20 bg-black/60 p-4 backdrop-blur-[10px]"
          >
            <p className="text-sm">
              Nota registrada! Você está a{" "}
              <span className="text-[#39FF14] font-semibold">R$ 50,00</span> de atingir sua meta de
              Mercado do mês.
            </p>
            <button type="button" className="mt-2 text-sm text-[#39FF14] font-medium">
              Ativar Controle Automático via Open Finance
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3">
        <div className="rounded-xl border border-white/20 bg-black/45 backdrop-blur-[10px] px-4 py-2 text-xs">
          <p className="text-white/75">Gasto Mensal / Limite</p>
          <p className="font-semibold">
            {formatCurrency(financialSummary.monthlySpent)} /{" "}
            {formatCurrency(financialSummary.monthlyLimit)}
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setScannerInsightOpen(true)}
          className="w-16 h-16 rounded-full border border-white/25 bg-white/20 backdrop-blur-[10px] hover:bg-white/30 text-white shadow-[0_8px_25px_rgba(0,0,0,0.35)]"
          title="Abrir scanner"
        >
          <Camera className="h-7 w-7" />
        </Button>
      </div>
    </>
  );
}
