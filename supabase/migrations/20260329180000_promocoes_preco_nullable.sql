-- Encartes DIA (e similares) gravam imagem sem preço numérico; NOT NULL em preco/price bloqueava o insert.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'promocoes_supermercados'
      AND column_name = 'price'
  ) THEN
    ALTER TABLE public.promocoes_supermercados ALTER COLUMN price DROP NOT NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'promocoes_supermercados'
      AND column_name = 'preco'
  ) THEN
    ALTER TABLE public.promocoes_supermercados ALTER COLUMN preco DROP NOT NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.promocoes_supermercados.preco IS
  'Pode ser NULL quando a oferta é só encarte/imagem (ex.: tabloide DIA no JSON).';
