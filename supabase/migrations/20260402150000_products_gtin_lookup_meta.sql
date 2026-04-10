-- Metadados para cache global de GTIN (Open Food Facts / Cosmos Bluesoft / manual)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS brand TEXT NULL,
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS source TEXT NULL;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_source_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_source_check
  CHECK (source IS NULL OR source IN ('off', 'cosmos', 'user'));

COMMENT ON COLUMN public.products.brand IS 'Marca (texto livre; ex. OFF brands ou Cosmos brand.name)';
COMMENT ON COLUMN public.products.thumbnail_url IS 'URL de miniatura pública (Cosmos thumbnail ou OFF image)';
COMMENT ON COLUMN public.products.source IS 'off = Open Food Facts; cosmos = Bluesoft; user = cadastro manual';
