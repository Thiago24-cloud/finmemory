-- Evita re-tentar Cosmos quando a imagem não existe no catálogo.
ALTER TABLE public.promocoes_supermercados
  ADD COLUMN IF NOT EXISTS tentativa_busca_imagem boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_promocoes_tentativa_busca_imagem
  ON public.promocoes_supermercados (tentativa_busca_imagem)
  WHERE tentativa_busca_imagem = true AND imagem_url IS NULL;

COMMENT ON COLUMN public.promocoes_supermercados.tentativa_busca_imagem IS
  'true = já tentámos Cosmos/ingest sem imagem; não repetir busca automática.';
