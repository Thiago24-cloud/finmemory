import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePartnership } from "@/hooks/usePartnership";
import { ArrowLeft, Plus, Trash2, Check, Loader2, ShoppingCart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  unit: string | null;
  checked: boolean;
  checked_by: string | null;
  added_by: string;
  created_at: string;
}

const ShoppingList = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { partnership, partnerProfile, loading: partnerLoading } = usePartnership();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchItems = useCallback(async () => {
    if (!partnership || partnership.status !== "active") return;
    const { data } = await supabase
      .from("shopping_list_items")
      .select("*")
      .eq("partnership_id", partnership.id)
      .order("checked", { ascending: true })
      .order("created_at", { ascending: false });
    setItems((data as ShoppingItem[]) || []);
    setLoading(false);
  }, [partnership]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Realtime subscription
  useEffect(() => {
    if (!partnership || partnership.status !== "active") return;

    const channel = supabase
      .channel("shopping-list")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shopping_list_items",
          filter: `partnership_id=eq.${partnership.id}`,
        },
        () => fetchItems()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [partnership, fetchItems]);

  const handleAdd = async () => {
    if (!newItem.trim() || !partnership || !user) return;
    setAdding(true);
    const { error } = await supabase.from("shopping_list_items").insert({
      partnership_id: partnership.id,
      name: newItem.trim(),
      added_by: user.id,
    });
    if (error) toast.error("Erro ao adicionar item");
    else setNewItem("");
    setAdding(false);
  };

  const handleToggle = async (item: ShoppingItem) => {
    await supabase
      .from("shopping_list_items")
      .update({
        checked: !item.checked,
        checked_by: !item.checked ? user!.id : null,
        checked_at: !item.checked ? new Date().toISOString() : null,
      })
      .eq("id", item.id);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("shopping_list_items").delete().eq("id", id);
  };

  const handleClearChecked = async () => {
    if (!partnership) return;
    const checkedIds = items.filter(i => i.checked).map(i => i.id);
    if (checkedIds.length === 0) return;
    await supabase.from("shopping_list_items").delete().in("id", checkedIds);
    toast.success("Itens comprados removidos");
  };

  if (partnerLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!partnership || partnership.status !== "active") {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="max-w-md mx-auto px-5 pt-5">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => navigate("/dashboard")} className="p-2 rounded-full hover:bg-muted transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-xl font-bold">Lista de Compras</h1>
          </div>
          <div className="text-center py-12">
            <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Sem parceria ativa</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Conecte-se com seu parceiro(a) para usar a lista compartilhada
            </p>
            <button
              onClick={() => navigate("/partnership")}
              className="px-6 py-3 rounded-xl gradient-primary text-primary-foreground font-semibold"
            >
              Criar Parceria
            </button>
          </div>
        </div>
      </div>
    );
  }

  const unchecked = items.filter(i => !i.checked);
  const checked = items.filter(i => i.checked);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-md mx-auto px-5 pb-24 pt-5">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate("/dashboard")} className="p-2 rounded-full hover:bg-muted transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-bold">Lista de Compras</h1>
          <span className="text-sm text-muted-foreground ml-auto">
            com {partnerProfile?.name || "Parceiro(a)"}
          </span>
        </div>

        {/* Add item */}
        <div className="flex gap-2 mb-6">
          <Input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder="Adicionar item..."
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <button
            onClick={handleAdd}
            disabled={adding || !newItem.trim()}
            className="px-4 rounded-xl gradient-primary text-primary-foreground hover:opacity-90 disabled:opacity-60 transition-opacity"
          >
            {adding ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
          </button>
        </div>

        {/* Pending items */}
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {unchecked.length === 0 && checked.length === 0 && (
              <div className="text-center py-12">
                <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">Lista vazia. Adicione itens!</p>
              </div>
            )}

            {unchecked.length > 0 && (
              <div className="bg-card rounded-2xl card-shadow overflow-hidden mb-4">
                {unchecked.map((item, idx) => (
                  <div key={item.id}>
                    <div className="flex items-center gap-3 p-4">
                      <button
                        onClick={() => handleToggle(item)}
                        className="w-6 h-6 rounded-full border-2 border-muted-foreground/30 hover:border-accent transition-colors shrink-0"
                      />
                      <span className="flex-1 text-foreground">{item.name}</span>
                      {item.quantity > 1 && (
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">{item.quantity}x</span>
                      )}
                      <button onClick={() => handleDelete(item.id)} className="p-1 hover:text-destructive transition-colors text-muted-foreground">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    {idx < unchecked.length - 1 && <div className="h-px bg-border mx-4" />}
                  </div>
                ))}
              </div>
            )}

            {checked.length > 0 && (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Comprados ({checked.length})</span>
                  <button onClick={handleClearChecked} className="text-xs text-destructive hover:underline">
                    Limpar
                  </button>
                </div>
                <div className="bg-card rounded-2xl card-shadow overflow-hidden opacity-60">
                  {checked.map((item, idx) => (
                    <div key={item.id}>
                      <div className="flex items-center gap-3 p-4">
                        <button
                          onClick={() => handleToggle(item)}
                          className="w-6 h-6 rounded-full bg-accent flex items-center justify-center shrink-0"
                        >
                          <Check className="h-3.5 w-3.5 text-accent-foreground" />
                        </button>
                        <span className="flex-1 line-through text-muted-foreground">{item.name}</span>
                        <button onClick={() => handleDelete(item.id)} className="p-1 hover:text-destructive transition-colors text-muted-foreground">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      {idx < checked.length - 1 && <div className="h-px bg-border mx-4" />}
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ShoppingList;
