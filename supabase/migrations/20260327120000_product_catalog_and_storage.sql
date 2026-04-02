-- =============================================================================
-- Catálogo mínimo: products + product_images + bucket Storage `product-images`
-- Regra no app: mapa usa imagem do bucket se existir; senão imagem_url do agente.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Produto canónico (GTIN opcional; nome para dedupe manual / futuro match)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gtin TEXT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_gtin_unique
  ON public.products (gtin)
  WHERE gtin IS NOT NULL AND trim(gtin) <> '';

COMMENT ON TABLE public.products IS 'Produto canónico; imagens em product_images + Storage.';

-- ---------------------------------------------------------------------------
-- 2) Imagens (ficheiros no bucket; path relativo ao bucket)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT true,
  source TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_images_one_primary
  ON public.product_images (product_id)
  WHERE is_primary = true;

CREATE INDEX IF NOT EXISTS idx_product_images_product
  ON public.product_images (product_id);

COMMENT ON TABLE public.product_images IS 'Paths em Storage bucket product-images; is_primary = foto principal no mapa.';
COMMENT ON COLUMN public.product_images.storage_path IS 'Ex.: 7891234567890/front.webp (sem prefixo do bucket).';

-- ---------------------------------------------------------------------------
-- 3) Ligação opcional nas promoções do agente e nos preços comunitários
-- ---------------------------------------------------------------------------
ALTER TABLE public.promocoes_supermercados
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_promocoes_product_id
  ON public.promocoes_supermercados (product_id)
  WHERE product_id IS NOT NULL;

ALTER TABLE public.price_points
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_price_points_product_id
  ON public.price_points (product_id)
  WHERE product_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4) RLS — leitura pública (mapa / API com anon); escrita via service role
-- ---------------------------------------------------------------------------
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_select_all" ON public.products;
CREATE POLICY "products_select_all"
  ON public.products FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "product_images_select_all" ON public.product_images;
CREATE POLICY "product_images_select_all"
  ON public.product_images FOR SELECT
  TO anon, authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- 5) Storage: bucket público para leitura de imagens de produto
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "product_images_public_read" ON storage.objects;
CREATE POLICY "product_images_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

-- Upload: apenas service role / conta de serviço (sem policy de INSERT para anon)
-- Quem usa SUPABASE_SERVICE_ROLE_KEY no servidor ignora RLS em storage com bypass.
