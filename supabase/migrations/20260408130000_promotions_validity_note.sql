-- Vigência por dia da semana / texto do encarte (folhetos tipo "Segunda de Ofertas")

ALTER TABLE public.promotions
  ADD COLUMN IF NOT EXISTS validity_note text;

COMMENT ON COLUMN public.promotions.validity_note IS
  'Resumo legível da vigência (ex.: somente terças 08/04/2026; seg e sex 06 e 10/04). Complementa valid_from/valid_until.';

ALTER TABLE public.promocoes_supermercados
  ADD COLUMN IF NOT EXISTS validity_note text;

COMMENT ON COLUMN public.promocoes_supermercados.validity_note IS
  'Mesmo significado que em public.promotions — encartes com ofertas por dia da semana.';
