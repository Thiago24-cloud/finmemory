import { Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useShopping } from "@/context/ShoppingProvider";
import { ShoppingListOverlay } from "./ShoppingListOverlay";

export function SearchHeader() {
  const {
    quickItem,
    setQuickItem,
    setQuickListOpen,
    addShoppingItem,
  } = useShopping();

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[92%] max-w-xl z-20">
      <div className="rounded-2xl border border-white/15 bg-white/10 backdrop-blur-[10px] px-3 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/65" />
          <Input
            placeholder="O que você precisa comprar hoje?"
            value={quickItem}
            onFocus={() => setQuickListOpen(true)}
            onChange={(e) => setQuickItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addShoppingItem(quickItem);
              }
            }}
            className="h-11 rounded-xl border-white/20 bg-black/35 pl-10 pr-10 text-white placeholder:text-white/55 focus-visible:ring-[#39FF14]/70"
          />
          <button
            type="button"
            onClick={() => addShoppingItem(quickItem)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-[#39FF14]/85 text-black p-1.5"
            title="Adicionar item"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <ShoppingListOverlay />
      </div>
    </div>
  );
}
