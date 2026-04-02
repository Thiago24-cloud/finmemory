-- Categoria inferida pelo modelo (encarte / vision) — opcional; mapa usa fallback se null.
ALTER TABLE public.promocoes_supermercados
  ADD COLUMN IF NOT EXISTS categoria text;

COMMENT ON COLUMN public.promocoes_supermercados.categoria IS
  'Categoria do produto (ex.: Hortifruti, Bebidas). Preenchida por extract-flyer-vision; merge do mapa usa Supermercado - Promoção · {categoria}.';
