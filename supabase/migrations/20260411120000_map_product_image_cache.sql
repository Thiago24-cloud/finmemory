-- Miniaturas reutilizáveis por nome de produto (mapa).
-- Curadoria grava (manual URL, Quick Add, ou após OFF/CSE); GET /api/map/points lê antes de APIs externas.

CREATE TABLE IF NOT EXISTS public.map_product_image_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  norm_key text NOT NULL,
  display_name text,
  image_url text NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT map_product_image_cache_norm_key_unique UNIQUE (norm_key)
);

CREATE INDEX IF NOT EXISTS idx_map_product_image_cache_norm_key
  ON public.map_product_image_cache (norm_key);

COMMENT ON TABLE public.map_product_image_cache IS
  'URL de miniatura por nome normalizado; evita repetir Open Food Facts / Google CSE para manga, filé mignon, etc.';

ALTER TABLE public.map_product_image_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "map_product_image_cache_select_all" ON public.map_product_image_cache;
CREATE POLICY "map_product_image_cache_select_all"
  ON public.map_product_image_cache FOR SELECT
  USING (true);

-- Escrita via service_role (API routes); sem policy INSERT para anon/authenticated.
