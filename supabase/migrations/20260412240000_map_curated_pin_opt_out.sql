-- Opt-out por loja: não aplicar bypass "sempre visível" Pomar da Vila / Sacolão São Jorge
-- (tratam-se como supermercado normal — pin só com ofertas no mapa).

CREATE TABLE IF NOT EXISTS public.map_curated_pin_opt_out (
  store_id uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_map_curated_pin_opt_out_created
  ON public.map_curated_pin_opt_out (created_at DESC);

COMMENT ON TABLE public.map_curated_pin_opt_out IS
  'store_id não usa curadoria Pomar/Sacolão (GET /api/map/stores): só visível com tem_oferta_hoje como outro supermercado.';
