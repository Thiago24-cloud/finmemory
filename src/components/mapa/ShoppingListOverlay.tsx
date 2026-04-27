import { AnimatePresence, motion } from "framer-motion";
import { useShopping } from "@/context/ShoppingProvider";

export function ShoppingListOverlay() {
  const {
    quickListOpen,
    setQuickListOpen,
    shoppingList,
    removeShoppingItem,
  } = useShopping();

  return (
    <AnimatePresence>
      {quickListOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -8, height: 0 }}
          className="overflow-hidden"
        >
          <div className="mt-3 rounded-xl border border-white/15 bg-black/35 p-3">
            <div className="flex items-center justify-between text-xs text-white/75 mb-2">
              <span>Lista de Compras Rápida</span>
              <button
                type="button"
                onClick={() => setQuickListOpen(false)}
                className="hover:text-white"
              >
                fechar
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {shoppingList.length ? (
                shoppingList.map((item) => (
                  <button
                    type="button"
                    key={item}
                    onClick={() => removeShoppingItem(item)}
                    className="text-xs rounded-full px-3 py-1 border border-white/20 bg-white/10 hover:bg-white/20"
                  >
                    {item} ×
                  </button>
                ))
              ) : (
                <span className="text-xs text-white/60">
                  Adicione itens para ativar o Radar de Decisão.
                </span>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
