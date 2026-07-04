-- Imagens de catálogo para estoque/insumos do lojista.
-- Usado após leitura de nota fiscal ou código de barras para enriquecer visualmente o estoque via Cosmos.

ALTER TABLE public.insumos_loja
  ADD COLUMN IF NOT EXISTS imagem_url text,
  ADD COLUMN IF NOT EXISTS imagem_source text,
  ADD COLUMN IF NOT EXISTS imagem_atualizada_em timestamptz;

COMMENT ON COLUMN public.insumos_loja.imagem_url IS
  'URL pública da imagem de catálogo do insumo, normalmente resolvida pelo Cosmos Bluesoft.';

COMMENT ON COLUMN public.insumos_loja.imagem_source IS
  'Origem da imagem do insumo (ex.: cosmos_gtin, cosmos_products_query).';

COMMENT ON COLUMN public.insumos_loja.imagem_atualizada_em IS
  'Data da última tentativa bem-sucedida de enriquecimento visual do insumo.';
