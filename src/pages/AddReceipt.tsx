import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Step = "capture" | "preview" | "processing" | "edit" | "success";

const AddReceipt = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("capture");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    estabelecimento: "",
    cnpj: "",
    data: "",
    total: "",
    categoria: "Alimentação",
    pagamento: "Cartão de Crédito",
    items: [] as { descricao: string; quantidade: number; valor_total: number }[],
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result as string);
        setStep("preview");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProcess = async () => {
    if (!imagePreview) return;
    setStep("processing");

    try {
      const base64 = imagePreview.split(",")[1];
      const { data, error } = await supabase.functions.invoke("process-receipt", {
        body: { imageBase64: base64, userId: user!.id },
      });

      if (error) throw error;

      const result = data?.data || {};
      setForm({
        estabelecimento: result.merchant_name || "",
        cnpj: result.cnpj || "",
        data: result.date || new Date().toISOString().split("T")[0],
        total: String(result.total_amount || ""),
        categoria: result.categoria || "Alimentação",
        pagamento: result.payment_method || "Cartão de Crédito",
        items: result.items || [],
      });
      setStep("edit");
    } catch (err: any) {
      toast.error("Erro ao processar nota: " + (err.message || "tente novamente"));
      setStep("preview");
    }
  };

  const handleSave = async () => {
    if (!user) return;

    try {
      // Upload image if available
      let receipt_image_url: string | null = null;
      if (imageFile) {
        const path = `${user.id}/${Date.now()}_${imageFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("receipts")
          .upload(path, imageFile);
        if (!uploadError) {
          receipt_image_url = path;
        }
      }

      const { error } = await supabase.from("transacoes").insert({
        user_id: user.id,
        estabelecimento: form.estabelecimento,
        cnpj: form.cnpj || null,
        data: form.data || null,
        total: parseFloat(form.total) || 0,
        forma_pagamento: form.pagamento,
        categoria: form.categoria,
        items: form.items,
        source: "ocr",
        receipt_image_url,
      });

      if (error) throw error;

      setStep("success");
      toast.success("Nota fiscal salva!");
      setTimeout(() => navigate("/dashboard"), 2000);
    } catch (err: any) {
      toast.error("Erro ao salvar: " + (err.message || "tente novamente"));
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-primary px-4 py-5">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate("/dashboard")} className="text-primary-foreground text-xl">←</button>
          <h1 className="text-lg font-bold text-primary-foreground">Adicionar Nota Fiscal</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {step === "capture" && (
          <div className="bg-card rounded-2xl card-shadow p-8 text-center animate-fade-in space-y-4">
            <p className="text-5xl">📷</p>
            <h2 className="text-xl font-bold text-foreground">Capture sua nota fiscal</h2>
            <p className="text-muted-foreground text-sm">Tire uma foto ou escolha uma imagem da galeria</p>
            <div className="flex flex-col gap-3 pt-2">
              <label className="cursor-pointer">
                <div className="gradient-primary text-primary-foreground font-semibold py-4 rounded-xl text-center hover:opacity-90 transition-opacity">
                  📸 Tirar Foto
                </div>
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
              </label>
              <label className="cursor-pointer">
                <div className="border-2 border-primary text-primary font-semibold py-4 rounded-xl text-center hover:bg-primary/5 transition-colors">
                  🖼️ Escolher da Galeria
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </label>
            </div>
          </div>
        )}

        {step === "preview" && imagePreview && (
          <div className="bg-card rounded-2xl card-shadow p-6 animate-fade-in space-y-4">
            <img src={imagePreview} alt="Nota fiscal" className="w-full rounded-xl max-h-80 object-contain bg-muted" />
            <div className="flex gap-3">
              <Button className="flex-1 gradient-primary text-primary-foreground font-semibold py-5 rounded-xl" onClick={handleProcess}>
                🤖 Processar Nota
              </Button>
              <Button variant="outline" className="flex-1 border-primary text-primary py-5 rounded-xl" onClick={() => { setImagePreview(null); setImageFile(null); setStep("capture"); }}>
                Tirar Outra
              </Button>
            </div>
          </div>
        )}

        {step === "processing" && (
          <div className="bg-card rounded-2xl card-shadow p-12 text-center animate-fade-in">
            <div className="text-5xl mb-4 animate-pulse-soft">🤖</div>
            <h2 className="text-xl font-bold text-foreground mb-2">Lendo sua nota fiscal...</h2>
            <p className="text-muted-foreground text-sm">Nossa IA está extraindo os dados da imagem</p>
            <div className="mt-6 h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full gradient-primary rounded-full animate-pulse-soft w-3/4" />
            </div>
          </div>
        )}

        {step === "edit" && (
          <div className="bg-card rounded-2xl card-shadow p-6 animate-fade-in space-y-4">
            <h2 className="text-lg font-bold text-foreground">Confirme os dados</h2>
            <div className="space-y-3">
              <Field label="Estabelecimento" value={form.estabelecimento} onChange={(v) => setForm({ ...form, estabelecimento: v })} />
              <Field label="CNPJ" value={form.cnpj} onChange={(v) => setForm({ ...form, cnpj: v })} />
              <Field label="Data" value={form.data} onChange={(v) => setForm({ ...form, data: v })} type="date" />
              <Field label="Valor Total (R$)" value={form.total} onChange={(v) => setForm({ ...form, total: v })} type="number" />
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Categoria</label>
                <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
                  {["Alimentação", "Saúde", "Transporte", "Lazer", "Educação", "Outros"].map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Forma de Pagamento</label>
                <select value={form.pagamento} onChange={(e) => setForm({ ...form, pagamento: e.target.value })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
                  {["Cartão de Crédito", "Cartão de Débito", "PIX", "Dinheiro"].map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>

              {form.items.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Itens detectados</label>
                  <div className="space-y-1 text-sm">
                    {form.items.map((item, i) => (
                      <div key={i} className="flex justify-between bg-muted rounded-lg px-3 py-2">
                        <span>{item.quantidade}x {item.descricao}</span>
                        <span className="text-muted-foreground">R$ {item.valor_total?.toFixed(2).replace(".", ",")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <Button className="w-full gradient-primary text-primary-foreground font-semibold py-5 rounded-xl mt-2" onClick={handleSave}>
              ✅ Salvar Nota Fiscal
            </Button>
          </div>
        )}

        {step === "success" && (
          <div className="bg-card rounded-2xl card-shadow p-12 text-center animate-fade-in">
            <p className="text-5xl mb-4">✅</p>
            <h2 className="text-xl font-bold text-foreground mb-2">Nota fiscal salva!</h2>
            <p className="text-muted-foreground text-sm">Redirecionando para o dashboard...</p>
          </div>
        )}
      </main>
    </div>
  );
};

const Field = ({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) => (
  <div>
    <label className="text-sm font-medium text-foreground mb-1 block">{label}</label>
    <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="rounded-lg" />
  </div>
);

export default AddReceipt;
