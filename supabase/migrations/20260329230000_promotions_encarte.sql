-- Tabela genérica de promoções extraídas de encarte (Vision) — campos alinhados ao fluxo extractPromoFromEncarte.
CREATE TABLE IF NOT EXISTS public.promotions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name    text        NOT NULL,
  promo_price     numeric(10, 2) NOT NULL,
  original_price  numeric(10, 2),
  unit            text,
  category        text,
  store_name      text        NOT NULL,
  valid_from      date,
  valid_until     date,
  active          boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promotions_store_active
  ON public.promotions (store_name, active);

CREATE INDEX IF NOT EXISTS idx_promotions_valid_until
  ON public.promotions (valid_until);

COMMENT ON TABLE public.promotions IS
  'Promoções extraídas de imagem de encarte (GPT-4o Vision). Mapa principal continua em promocoes_supermercados.';

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "promotions_select_authenticated" ON public.promotions;
CREATE POLICY "promotions_select_authenticated"
  ON public.promotions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "promotions_select_anon" ON public.promotions;
CREATE POLICY "promotions_select_anon"
  ON public.promotions FOR SELECT
  TO anon
  USING (true);
