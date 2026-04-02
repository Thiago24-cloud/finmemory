-- =============================================================================
-- FinMemory — Permitir preco/price NULL em promocoes_supermercados (encarte DIA)
-- Copiar e colar no Supabase → SQL Editor (idempotente).
-- Sem isto, o agente pode falhar ao inserir tabloides só com imagem_url.
-- =============================================================================

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
