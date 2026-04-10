-- Fila de encartes → extração Vision → várias linhas em public.promotions

CREATE TABLE IF NOT EXISTS public.encarte_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  store_id uuid NOT NULL REFERENCES public.stores (id) ON DELETE CASCADE,
  image_url text NOT NULL,
  source text,
  status text NOT NULL DEFAULT 'pending',
  processed_at timestamptz,
  error_msg text,
  products_extracted int NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_encarte_queue_status_created
  ON public.encarte_queue (status, created_at);

ALTER TABLE public.promotions
  ADD COLUMN IF NOT EXISTS encarte_queue_id uuid REFERENCES public.encarte_queue (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_individual_product boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS source text;

CREATE INDEX IF NOT EXISTS idx_promotions_encarte_queue_id
  ON public.promotions (encarte_queue_id)
  WHERE encarte_queue_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_promotions_individual_store
  ON public.promotions (store_id, is_individual_product, active)
  WHERE store_id IS NOT NULL;

COMMENT ON TABLE public.encarte_queue IS 'Fila de imagens de encarte para extração GPT Vision → produtos em promotions.';
COMMENT ON COLUMN public.promotions.is_individual_product IS 'false = linha agregada/encarte inteiro; true = produto individual.';

-- Marcar registros antigos que parecem encarte inteiro (título genérico)
UPDATE public.promotions
SET is_individual_product = false
WHERE (
    product_name ILIKE '%encarte%'
    OR product_name ILIKE '%folheto%'
    OR product_name ILIKE '%promoç%'
    OR product_name IS NULL
    OR length(trim(product_name)) < 3
  );
