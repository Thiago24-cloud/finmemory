import { AnimatePresence, motion } from "framer-motion";
import { useShopping } from "@/context/ShoppingProvider";

export type DecisionCarouselData = {
  savingsGap: number;
  economyStoresCount: number;
  convenienceStoreName: string;
};

function formatCurrency(value: number) {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

type Props = {
  decisionData: DecisionCarouselData | null;
};

export function DecisionCarousel({ decisionData }: Props) {
  const { shoppingList, selectedDecision, setSelectedDecision } = useShopping();

  return (
    <AnimatePresence>
      {shoppingList.length > 0 && decisionData && (
        <motion.div
          initial={{ opacity: 0, y: 36 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 36 }}
          className="absolute bottom-40 left-0 right-0 z-20"
        >
          <div className="px-4 overflow-x-auto scrollbar-hide">
            <div className="flex gap-3 min-w-max pb-2">
              <button
                type="button"
                onClick={() => setSelectedDecision("economy")}
                className={`w-[320px] rounded-2xl border px-4 py-3 text-left backdrop-blur-[10px] ${
                  selectedDecision === "economy"
                    ? "border-[#39FF14]/90 bg-[#39FF14]/18"
                    : "border-white/20 bg-black/40"
                }`}
              >
                <p className="text-xs uppercase tracking-wide text-[#39FF14] font-semibold">
                  Rota de Máxima Economia
                </p>
                <p className="font-semibold mt-1">
                  Economize {formatCurrency(decisionData.savingsGap || 15)} visitando{" "}
                  {decisionData.economyStoresCount} mercados
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedDecision("convenience")}
                className={`w-[320px] rounded-2xl border px-4 py-3 text-left backdrop-blur-[10px] ${
                  selectedDecision === "convenience"
                    ? "border-[#D4AF37]/90 bg-[#D4AF37]/18"
                    : "border-white/20 bg-black/40"
                }`}
              >
                <p className="text-xs uppercase tracking-wide text-[#D4AF37] font-semibold">
                  Rota de Máxima Conveniência
                </p>
                <p className="font-semibold mt-1">
                  Toda sua lista está no {decisionData.convenienceStoreName} a 2 min de você
                </p>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
