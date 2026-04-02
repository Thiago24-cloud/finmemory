ALTER TABLE public.promotions
  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_promotions_store_id_active
  ON public.promotions (store_id, active)
  WHERE store_id IS NOT NULL;

COMMENT ON COLUMN public.promotions.store_id IS
  'Loja em public.stores; usado no painel /mapa ao abrir o pin da loja.';
