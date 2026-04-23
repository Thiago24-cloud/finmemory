-- Gate de origem para o mapa de preços.
-- Objetivo: exibir no mapa apenas promoções aprovadas no painel (bot_fila_aprovado)
-- ou inserções manuais de admin (admin_manual), mantendo legado invisível sem apagar dados.

ALTER TABLE public.price_points
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'legado';

UPDATE public.price_points
SET source = 'legado'
WHERE source IS NULL OR btrim(source) = '';

CREATE INDEX IF NOT EXISTS idx_price_points_source_created_at
  ON public.price_points (source, created_at DESC);
