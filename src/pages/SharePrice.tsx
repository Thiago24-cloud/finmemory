import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, MapPin, Loader2, CheckCircle, ImageIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const CATEGORIES = [
  "Supermercado",
  "Farmácia",
  "Posto de Combustível",
  "Bar/Restaurante",
  "Padaria",
  "Hortifruti",
  "Eletrônicos",
  "Outros",
];

const SharePrice = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [productName, setProductName] = useState("");
  const [price, setPrice] = useState("");
  const [storeName, setStoreName] = useState("");
  const [category, setCategory] = useState("Supermercado");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Auto-get location on mount
  useEffect(() => {
    getLocation();
  }, []);

  const getLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocalização não suportada pelo navegador");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setLocating(false);
      },
      () => {
        toast.error("Não foi possível obter sua localização");
        setLocating(false);
      }
    );
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx. 10MB)");
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return toast.error("Faça login para compartilhar preços");
    if (!productName.trim() || !price || !storeName.trim()) {
      return toast.error("Preencha produto, preço e loja");
    }
    if (lat === null || lng === null) {
      return toast.error("Localização necessária. Clique em 'Obter localização'");
    }

    setSubmitting(true);
    try {
      let imageUrl: string | null = null;

      // Upload photo if provided
      if (imageFile) {
        const ext = imageFile.name.split(".").pop() || "jpg";
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("price-photos")
          .upload(path, imageFile, { contentType: imageFile.type });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("price-photos")
          .getPublicUrl(path);
        imageUrl = urlData.publicUrl;
      }

      // Insert price point
      const { error } = await supabase.from("price_points").insert({
        user_id: user.id,
        product_name: productName.trim(),
        price: parseFloat(price.replace(",", ".")),
        store_name: storeName.trim(),
        category,
        lat,
        lng,
        image_url: imageUrl,
      });

      if (error) throw error;

      toast.success("Preço compartilhado! Obrigado por ajudar a comunidade 🎉");
      navigate("/mapa-precos");
    } catch (err: any) {
      toast.error(err.message || "Erro ao compartilhar preço");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm font-medium text-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>
        <h1 className="text-base font-semibold text-foreground ml-auto">
          📸 Compartilhar Preço
        </h1>
      </header>

      <form onSubmit={handleSubmit} className="max-w-md mx-auto px-5 py-6 space-y-5">
        {/* Photo upload */}
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">
            Foto do preço (opcional)
          </label>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImageChange}
            className="hidden"
          />
          {imagePreview ? (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full rounded-2xl overflow-hidden border border-border card-shadow"
            >
              <img src={imagePreview} alt="Preview" className="w-full h-48 object-cover" />
              <p className="text-xs text-muted-foreground py-2">Toque para trocar</p>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full h-40 rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <Camera className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Tirar foto ou escolher imagem</span>
            </button>
          )}
        </div>

        {/* Product name */}
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">Produto *</label>
          <Input
            placeholder="Ex: Arroz 5kg, Gasolina Comum, Dipirona..."
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            required
          />
        </div>

        {/* Price */}
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">Preço (R$) *</label>
          <Input
            placeholder="Ex: 24,90"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="decimal"
            required
          />
        </div>

        {/* Store name */}
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">Loja/Estabelecimento *</label>
          <Input
            placeholder="Ex: Supermercado Extra, Posto Shell..."
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            required
          />
        </div>

        {/* Category */}
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">Categoria</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                  cat === category
                    ? "bg-accent text-accent-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Location */}
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">Localização</label>
          {lat !== null && lng !== null ? (
            <div className="flex items-center gap-2 text-sm text-accent">
              <CheckCircle className="h-4 w-4" />
              <span>Localização obtida ({lat.toFixed(4)}, {lng.toFixed(4)})</span>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={getLocation}
              disabled={locating}
              className="w-full"
            >
              {locating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <MapPin className="h-4 w-4 mr-2" />
              )}
              {locating ? "Obtendo localização..." : "Obter localização"}
            </Button>
          )}
        </div>

        {/* Submit */}
        <Button
          type="submit"
          disabled={submitting}
          className="w-full h-12 text-base font-semibold gradient-primary text-primary-foreground rounded-2xl"
        >
          {submitting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            "Compartilhar Preço 🎉"
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Ao compartilhar, você ajuda outras pessoas a encontrar os melhores preços perto delas.
        </p>
      </form>
    </div>
  );
};

export default SharePrice;
