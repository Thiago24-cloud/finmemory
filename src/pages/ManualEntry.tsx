import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const CATEGORIES = [
  "Supermercado", "Restaurante", "Transporte", "Farmácia", "Combustível",
  "Vestuário", "Eletrônicos", "Serviços", "Padaria", "Feira", "Lazer", "Outros",
];

const ManualEntry = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [estabelecimento, setEstabelecimento] = useState("");
  const [total, setTotal] = useState("");
  const [data, setData] = useState(new Date().toISOString().split("T")[0]);
  const [categoria, setCategoria] = useState("Outros");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [descricao, setDescricao] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return toast.error("Faça login para adicionar gastos");
    if (!estabelecimento.trim() || !total) return toast.error("Preencha estabelecimento e valor");

    setSubmitting(true);
    try {
      const { error } = await supabase.from("transacoes").insert({
        user_id: user.id,
        estabelecimento: estabelecimento.trim(),
        total: parseFloat(total.replace(",", ".")) || 0,
        data: data || null,
        categoria,
        forma_pagamento: formaPagamento.trim() || null,
        source: "manual",
        items: descricao.trim()
          ? [{ descricao: descricao.trim(), quantidade: 1, valor_total: parseFloat(total.replace(",", ".")) || 0 }]
          : [],
      });

      if (error) throw error;
      toast.success("Gasto adicionado com sucesso! ✅");
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-1 text-sm font-medium text-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>
        <h1 className="text-base font-semibold text-foreground ml-auto">📝 Novo Gasto Manual</h1>
      </header>

      <form onSubmit={handleSubmit} className="max-w-md mx-auto px-5 py-6 space-y-5">
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">Estabelecimento *</label>
          <Input
            placeholder="Ex: Padaria do João, Feira livre..."
            value={estabelecimento}
            onChange={(e) => setEstabelecimento(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">Valor (R$) *</label>
          <Input
            placeholder="Ex: 45,90"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            inputMode="decimal"
            required
          />
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">Data</label>
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">Descrição (opcional)</label>
          <Input
            placeholder="Ex: Pão, leite e café..."
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
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
            placeholder="Ex: Pix, Dinheiro, Cartão..."
            value={formaPagamento}
            onChange={(e) => setFormaPagamento(e.target.value)}
          />
        </div>

        <Button
          type="submit"
          disabled={submitting}
          className="w-full h-12 text-base font-semibold gradient-primary text-primary-foreground rounded-2xl"
        >
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Salvar Gasto ✅"}
        </Button>
      </form>
    </div>
  );
};

export default ManualEntry;
