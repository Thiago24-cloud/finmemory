-- Catálogo do lojista (tenant = store_id). O mapa consome cópias em promotions + price_points.

CREATE TABLE IF NOT EXISTS public.merchant_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores (id) ON DELETE CASCADE,
  name text NOT NULL,
  price numeric(14, 2) NOT NULL CHECK (price >= 0),
  image_url text,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_merchant_products_store_active
  ON public.merchant_products (store_id, active, created_at DESC);

COMMENT ON TABLE public.merchant_products IS
  'Estoque/ofertas do lojista (multitenancy por store_id). Publicação no mapa via API merchant.';

ALTER TABLE public.merchant_products ENABLE ROW LEVEL SECURITY;

-- Atalho opcional no utilizador varejista (redundante com merchant_store_profiles; útil para JOIN rápido).
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.users.store_id IS
  'Loja titular quando account_type = varejista (espelho de merchant_store_profiles / stores.owner_user_id).';
