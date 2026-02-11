import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { createPricePointsFromTransaction } from "@/lib/autoPricePoints";

type Step = "capture" | "preview" | "processing" | "edit" | "saving" | "success";

/** Compress image to max ~1.5MB base64 */
async function compressImage(file: File, maxSizeMB = 1.5): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        const maxDimension = 2000;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height / width) * maxDimension;
            width = maxDimension;
          } else {
            width = (width / height) * maxDimension;
            height = maxDimension;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        let quality = 0.8;
        let base64 = canvas.toDataURL("image/jpeg", quality);
        while (base64.length > maxSizeMB * 1024 * 1024 * 1.37 && quality > 0.1) {
          quality -= 0.1;
          base64 = canvas.toDataURL("image/jpeg", quality);
        }
        resolve(base64);
      };
      img.onerror = reject;
      img.src = e.target!.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const AddReceipt = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("capture");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    estabelecimento: "",
    cnpj: "",
    data: "",
    total: "",
    categoria: "Alimentação",
    pagamento: "Cartão de Crédito",
    items: [] as { name: string; price: number }[],
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!validTypes.includes(file.type)) {
      setError("Formato não suportado. Use JPG, PNG ou WebP.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Imagem muito grande. Máximo 10MB.");
      return;
    }

    try {
      const compressed = await compressImage(file);
      setImagePreview(compressed);
      setImageFile(file);
      setStep("preview");
    } catch {
      setError("Erro ao processar imagem. Tente outra.");
    }
  };

  const handleProcess = async () => {
    if (!imagePreview) return;
    setStep("processing");
    setError(null);

    try {
      const base64 = imagePreview.split(",")[1];
      const { data, error: fnError } = await supabase.functions.invoke("process-receipt", {
        body: { imageBase64: base64, userId: user!.id },
      });

      if (fnError) throw fnError;

      const result = data?.data || {};
      setForm({
        estabelecimento: result.merchant_name || "",
        cnpj: result.cnpj || "",
        data: result.date || new Date().toISOString().split("T")[0],
        total: String(result.total_amount || ""),
        categoria: result.categoria || "Alimentação",
        pagamento: result.payment_method || "Cartão de Crédito",
        items: (result.items || []).map((i: any) => ({
          name: i.descricao || i.name || "",
          price: i.valor_total || i.price || 0,
        })),
      });
      setStep("edit");
    } catch (err: any) {
      toast.error("Erro ao processar nota: " + (err.message || "tente novamente"));
      setStep("preview");
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setStep("saving");
    setError(null);

    try {
      let receipt_image_url: string | null = null;
      if (imageFile) {
        const path = `${user.id}/${Date.now()}_${imageFile.name}`;
        const { error: uploadError } = await supabase.storage.from("receipts").upload(path, imageFile);
        if (!uploadError) receipt_image_url = path;
      }

      const { error: insertError } = await supabase.from("transacoes").insert({
        user_id: user.id,
        estabelecimento: form.estabelecimento,
        cnpj: form.cnpj || null,
        data: form.data || null,
        total: parseFloat(form.total) || 0,
        forma_pagamento: form.pagamento,
        categoria: form.categoria,
        items: form.items.map((i) => ({
          descricao: i.name,
          quantidade: 1,
          valor_total: i.price,
        })),
        source: "ocr",
        receipt_image_url,
      });

      if (insertError) throw insertError;

      // Auto-populate price map from items
      await createPricePointsFromTransaction({
        userId: user.id,
        storeName: form.estabelecimento,
        category: form.categoria,
        items: form.items.map((i) => ({
          descricao: i.name,
          quantidade: 1,
          valor_total: i.price,
        })),
      });

      setStep("success");
      toast.success("Nota fiscal salva!");
      setTimeout(() => navigate("/dashboard"), 2000);
    } catch (err: any) {
      toast.error("Erro ao salvar: " + (err.message || "tente novamente"));
      setStep("edit");
    }
  };

  const updateItem = (index: number, field: "name" | "price", value: string | number) => {
    setForm((prev) => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      return { ...prev, items: newItems };
    });
  };

  const addItem = () => {
    setForm((prev) => ({ ...prev, items: [...prev.items, { name: "", price: 0 }] }));
  };

  const removeItem = (index: number) => {
    setForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  };

  const reset = () => {
    setStep("capture");
    setImagePreview(null);
    setImageFile(null);
    setError(null);
    setForm({ estabelecimento: "", cnpj: "", data: "", total: "", categoria: "Alimentação", pagamento: "Cartão de Crédito", items: [] });
  };

  return (
    <div className="min-h-screen gradient-primary p-5 font-sans">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="bg-primary-foreground/20 border-none text-primary-foreground py-2 px-4 rounded-lg cursor-pointer text-sm hover:bg-primary-foreground/30 transition-colors"
        >
          ← Voltar
        </button>
        <h1 className="text-primary-foreground text-2xl font-bold">📸 Escanear Nota</h1>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive py-3 px-4 rounded-xl mb-5 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* CAPTURE */}
      {step === "capture" && (
        <div className="bg-card rounded-3xl py-10 px-6 text-center card-shadow animate-fade-in">
          <div className="text-6xl mb-4">📄</div>
          <h2 className="text-xl text-foreground font-bold mb-2">Tire uma foto da nota fiscal</h2>
          <p className="text-sm text-muted-foreground mb-8">
            Posicione a nota em uma superfície plana com boa iluminação
          </p>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="gradient-primary text-primary-foreground border-none py-4 px-6 rounded-xl text-base font-semibold cursor-pointer transition-transform hover:scale-[1.02]"
            >
              📷 Tirar Foto
            </button>
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileSelect} className="hidden" />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="bg-muted text-foreground border-none py-4 px-6 rounded-xl text-base cursor-pointer hover:bg-border transition-colors"
            >
              🖼️ Escolher da Galeria
            </button>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileSelect} className="hidden" />
          </div>
          <p className="text-xs text-muted-foreground mt-4">Formatos aceitos: JPG, PNG, WebP (máx. 10MB)</p>
        </div>
      )}

      {/* PREVIEW */}
      {step === "preview" && imagePreview && (
        <div className="bg-card rounded-3xl p-6 text-center card-shadow animate-fade-in">
          <img src={imagePreview} alt="Preview" className="max-w-full max-h-[400px] rounded-xl mb-6 card-shadow mx-auto" />
          <div className="flex flex-col gap-3">
            <button type="button" onClick={handleProcess} className="gradient-primary text-primary-foreground border-none py-4 px-6 rounded-xl text-base font-semibold cursor-pointer">
              ✅ Processar Nota
            </button>
            <button type="button" onClick={reset} className="bg-muted text-foreground border-none py-4 px-6 rounded-xl text-base cursor-pointer">
              🔄 Tirar Outra Foto
            </button>
          </div>
        </div>
      )}

      {/* PROCESSING */}
      {step === "processing" && (
        <div className="bg-card rounded-3xl py-16 px-6 text-center card-shadow animate-fade-in">
          <div className="w-12 h-12 border-4 border-muted border-t-primary rounded-full animate-spin mx-auto mb-6" />
          <h2 className="text-xl text-foreground font-bold mb-2">Lendo sua nota fiscal...</h2>
          <p className="text-sm text-muted-foreground">Isso pode levar alguns segundos</p>
        </div>
      )}

      {/* EDIT */}
      {step === "edit" && (
        <div className="bg-card rounded-3xl p-6 card-shadow animate-fade-in">
          <h2 className="text-xl text-foreground font-bold mb-1">Confira os dados</h2>
          <p className="text-sm text-muted-foreground mb-4">Corrija se necessário antes de salvar</p>

          {imagePreview && (
            <img src={imagePreview} alt="Nota" className="w-full max-h-[150px] object-cover rounded-xl mb-5" />
          )}

          <div className="space-y-4 mb-6">
            <Field label="Estabelecimento *" value={form.estabelecimento} onChange={(v) => setForm({ ...form, estabelecimento: v })} />
            <Field label="CNPJ" value={form.cnpj} onChange={(v) => setForm({ ...form, cnpj: v })} placeholder="00.000.000/0000-00" />
            <div className="flex gap-3">
              <div className="flex-1">
                <Field label="Data" value={form.data} onChange={(v) => setForm({ ...form, data: v })} type="date" />
              </div>
              <div className="flex-1">
                <Field label="Valor Total *" value={form.total} onChange={(v) => setForm({ ...form, total: v })} type="number" placeholder="0.00" />
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-foreground mb-1.5">Categoria</label>
                <select
                  value={form.categoria}
                  onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                  className="w-full py-3 px-3 border border-input rounded-lg text-sm bg-background text-foreground"
                >
                  {["Supermercado", "Restaurante", "Farmácia", "Combustível", "Eletrônicos", "Vestuário", "Serviços", "Alimentação", "Outros"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-foreground mb-1.5">Pagamento</label>
                <select
                  value={form.pagamento}
                  onChange={(e) => setForm({ ...form, pagamento: e.target.value })}
                  className="w-full py-3 px-3 border border-input rounded-lg text-sm bg-background text-foreground"
                >
                  {["Cartão de Crédito", "Débito", "Dinheiro", "PIX"].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Items */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Itens ({form.items.length})
              </label>
              {form.items.map((item, index) => (
                <div key={index} className="flex gap-2 mb-2 items-center">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => updateItem(index, "name", e.target.value)}
                    className="flex-[2] py-3 px-3 border border-input rounded-lg text-sm bg-background text-foreground"
                    placeholder="Nome do item"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={item.price || ""}
                    onChange={(e) => updateItem(index, "price", parseFloat(e.target.value) || 0)}
                    className="flex-1 min-w-[80px] py-3 px-3 border border-input rounded-lg text-sm bg-background text-foreground"
                    placeholder="0.00"
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="bg-destructive/10 text-destructive border-none w-9 h-9 rounded-lg cursor-pointer text-sm hover:bg-destructive/20"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addItem}
                className="bg-muted text-primary border-none py-2.5 px-4 rounded-lg text-sm cursor-pointer w-full hover:bg-border"
              >
                + Adicionar Item
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={handleSave}
              className="gradient-primary text-primary-foreground border-none py-4 px-6 rounded-xl text-base font-semibold cursor-pointer"
            >
              💾 Salvar Transação
            </button>
            <button type="button" onClick={reset} className="bg-muted text-foreground border-none py-4 px-6 rounded-xl text-base cursor-pointer">
              🔄 Escanear Outra
            </button>
          </div>
        </div>
      )}

      {/* SAVING */}
      {step === "saving" && (
        <div className="bg-card rounded-3xl py-16 px-6 text-center card-shadow animate-fade-in">
          <div className="w-12 h-12 border-4 border-muted border-t-primary rounded-full animate-spin mx-auto mb-6" />
          <h2 className="text-xl text-foreground font-bold">Salvando transação...</h2>
        </div>
      )}

      {/* SUCCESS */}
      {step === "success" && (
        <div className="bg-card rounded-3xl py-16 px-6 text-center card-shadow animate-fade-in">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl text-accent font-bold mb-2">Nota fiscal salva!</h2>
          <p className="text-sm text-muted-foreground">Redirecionando para o dashboard...</p>
        </div>
      )}
    </div>
  );
};

const Field = ({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) => (
  <div>
    <label className="block text-sm font-medium text-foreground mb-1.5">{label}</label>
    <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="rounded-lg py-3" placeholder={placeholder} />
  </div>
);

export default AddReceipt;
