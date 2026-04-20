-- Recência no mapa + confirmação colaborativa (PATCH via API com service role).
ALTER TABLE public.price_points
  ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ;

UPDATE public.price_points
SET atualizado_em = created_at
WHERE atualizado_em IS NULL;

COMMENT ON COLUMN public.price_points.atualizado_em IS 'Última atualização ou confirmação do preço no mapa; usado em “Visto há…”.';
