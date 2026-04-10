-- Campos estruturados para extração Vision (encarte): preço clube, imagens, validade, desconto

ALTER TABLE public.promotions
  ADD COLUMN IF NOT EXISTS club_price numeric(10, 2),
  ADD COLUMN IF NOT EXISTS flyer_image_url text,
  ADD COLUMN IF NOT EXISTS product_image_url text,
  ADD COLUMN IF NOT EXISTS image_hint text,
  ADD COLUMN IF NOT EXISTS discount_pct numeric(6, 2);

COMMENT ON COLUMN public.promotions.club_price IS 'Preço para cliente clube / cartão, se constar no encarte.';
COMMENT ON COLUMN public.promotions.flyer_image_url IS 'URL da imagem do encarte (página ou folheto completo).';
COMMENT ON COLUMN public.promotions.product_image_url IS 'URL de imagem específica do produto (crop/CDN), se existir.';
COMMENT ON COLUMN public.promotions.image_hint IS 'Descrição curta do que aparece na arte para este item (Vision).';
COMMENT ON COLUMN public.promotions.discount_pct IS 'Percentual de desconto quando explícito ou calculado De→Por.';

ALTER TABLE public.promocoes_supermercados
  ADD COLUMN IF NOT EXISTS club_price numeric(10, 2),
  ADD COLUMN IF NOT EXISTS valid_from date;

COMMENT ON COLUMN public.promocoes_supermercados.club_price IS 'Preço clube/cartão quando extraído do encarte.';
COMMENT ON COLUMN public.promocoes_supermercados.valid_from IS 'Início da vigência da oferta no encarte (se legível).';

CREATE INDEX IF NOT EXISTS idx_promotions_store_active_valid_until
  ON public.promotions (store_id, active, valid_until)
  WHERE active = true AND store_id IS NOT NULL AND is_individual_product = true;
