-- Match agent: nome canônico e termos de busca para cruzar insumo ↔ mapa (GTIN + texto).

ALTER TABLE public.insumos_loja
  ADD COLUMN IF NOT EXISTS canonical_name text,
  ADD COLUMN IF NOT EXISTS match_termos jsonb,
  ADD COLUMN IF NOT EXISTS match_source text,
  ADD COLUMN IF NOT EXISTS match_atualizado_em timestamptz;

COMMENT ON COLUMN public.insumos_loja.canonical_name IS
  'Nome canônico do produto (Cosmos/heurística) para match no mapa.';

COMMENT ON COLUMN public.insumos_loja.match_termos IS
  'Termos de busca no mapa, ex.: ["arroz parboilizado", "camil"].';

COMMENT ON COLUMN public.insumos_loja.match_source IS
  'Origem do match: cosmos_gtin, cosmos_query, heuristic, manual.';

CREATE INDEX IF NOT EXISTS idx_insumos_loja_ean_ativo
  ON public.insumos_loja (ean)
  WHERE ean IS NOT NULL AND ativo = true;
