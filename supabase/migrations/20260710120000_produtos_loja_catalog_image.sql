-- Liga produtos_loja ao estoque (insumos_loja) e rastreia origem da imagem.

ALTER TABLE public.produtos_loja
  ADD COLUMN IF NOT EXISTS ean text,
  ADD COLUMN IF NOT EXISTS categoria text,
  ADD COLUMN IF NOT EXISTS imagem_source text,
  ADD COLUMN IF NOT EXISTS insumo_id uuid REFERENCES public.insumos_loja (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_produtos_loja_insumo_id
  ON public.produtos_loja (loja_id, insumo_id)
  WHERE insumo_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_produtos_loja_ean
  ON public.produtos_loja (loja_id, ean)
  WHERE ean IS NOT NULL;

COMMENT ON COLUMN public.produtos_loja.insumo_id IS
  'Insumo de origem quando sincronizado do estoque (sync-catalog).';
COMMENT ON COLUMN public.produtos_loja.imagem_source IS
  'Origem da imagem: openfoodfacts, cosmos, generic, custom, google, none.';
