-- Página pública da loja + QR + clientes + eventos. Aditivo; sem DROP.

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS public_slug text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stores_public_slug
  ON public.stores (public_slug)
  WHERE public_slug IS NOT NULL AND public_slug <> '';

COMMENT ON COLUMN public.stores.public_slug IS
  'Slug único para página pública B2C /loja/{slug}.';

CREATE TABLE IF NOT EXISTS public.store_qr_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL UNIQUE REFERENCES public.stores(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  target_path text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_qr_codes_code
  ON public.store_qr_codes (code)
  WHERE active = true;

COMMENT ON TABLE public.store_qr_codes IS
  'QR único da loja (balcão) apontando para /loja/{slug} no app consumidor.';

CREATE TABLE IF NOT EXISTS public.restaurant_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  whatsapp_digits text NOT NULL,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, whatsapp_digits)
);

CREATE INDEX IF NOT EXISTS idx_restaurant_customers_store
  ON public.restaurant_customers (store_id);

CREATE INDEX IF NOT EXISTS idx_restaurant_customers_whatsapp
  ON public.restaurant_customers (whatsapp_digits);

COMMENT ON TABLE public.restaurant_customers IS
  'Clientes leves da loja (nome + WhatsApp) via página pública / QR.';

CREATE TABLE IF NOT EXISTS public.store_public_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  event_type text NOT NULL
    CHECK (event_type IN (
      'qr_code_scanned',
      'public_page_viewed',
      'customer_registered',
      'whatsapp_clicked',
      'order_started'
    )),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_public_events_store_created
  ON public.store_public_events (store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_store_public_events_type
  ON public.store_public_events (event_type, created_at DESC);

COMMENT ON TABLE public.store_public_events IS
  'Eventos da página pública da loja (QR, view, cadastro, WhatsApp, pedido).';

ALTER TABLE public.store_qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_public_events ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.store_qr_codes TO service_role;
GRANT ALL ON public.restaurant_customers TO service_role;
GRANT ALL ON public.store_public_events TO service_role;
