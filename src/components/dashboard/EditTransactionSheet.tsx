import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";

const CATEGORIES = [
  "Supermercado", "Restaurante", "Transporte", "Farmácia", "Combustível",
  "Vestuário", "Eletrônicos", "Serviços", "Lazer", "Outros",
];

interface Transaction {
  id: string;
  estabelecimento: string;
  data: string;
  total: number;
  categoria: string;
  forma_pagamento: string;
}

interface EditTransactionSheetProps {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function EditTransactionSheet({ transaction, open, onOpenChange, onSaved }: EditTransactionSheetProps) {
  const [estabelecimento, setEstabelecimento] = useState("");
  const [data, setData] = useState("");
  const [total, setTotal] = useState("");
  const [categoria, setCategoria] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Sync state when transaction changes
  const resetForm = (t: Transaction) => {
    setEstabelecimento(t.estabelecimento || "");
    setData(t.data || "");
    setTotal(String(t.total || 0));
    setCategoria(t.categoria || "Outros");
    setFormaPagamento(t.forma_pagamento || "");
  };

  // Reset when opening
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && transaction) resetForm(transaction);
    onOpenChange(isOpen);
  };

  const handleSave = async () => {
    if (!transaction) return;
    setSaving(true);
    const { error } = await supabase
      .from("transacoes")
      .update({
        estabelecimento: estabelecimento.trim(),
        data: data || null,
        total: parseFloat(total.replace(",", ".")) || 0,
        categoria,
        forma_pagamento: formaPagamento.trim() || null,
      })
      .eq("id", transaction.id);

    if (error) {
      toast.error("Erro ao salvar alterações");
    } else {
      toast.success("Transação atualizada!");
      onSaved();
      onOpenChange(false);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!transaction) return;
    setDeleting(true);
    const { error } = await supabase
      .from("transacoes")
      .delete()
      .eq("id", transaction.id);

    if (error) {
      toast.error("Erro ao excluir transação");
    } else {
      toast.success("Transação excluída");
      onSaved();
      onOpenChange(false);
    }
    setDeleting(false);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Editar Transação</SheetTitle>
          <SheetDescription>Altere os dados da compra</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Estabelecimento</label>
            <Input value={estabelecimento} onChange={(e) => setEstabelecimento(e.target.value)} />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Data</label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Valor (R$)</label>
            <Input
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              inputMode="decimal"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Categoria</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoria(cat)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                    cat === categoria
                      ? "bg-accent text-accent-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Forma de Pagamento</label>
            <Input
              placeholder="Ex: Cartão, Pix, Dinheiro..."
              value={formaPagamento}
              onChange={(e) => setFormaPagamento(e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 gradient-primary text-primary-foreground rounded-xl"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-xl"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
