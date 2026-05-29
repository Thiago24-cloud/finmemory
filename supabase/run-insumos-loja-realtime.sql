-- Cole no SQL Editor do Supabase (sync insumos celular ↔ desktop no painel Parceiros).
-- Equivalente a: supabase/migrations/20260530120000_insumos_loja_realtime.sql

ALTER TABLE public.insumos_loja REPLICA IDENTITY FULL;
ALTER TABLE public.notas_entrada_loja REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'insumos_loja'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.insumos_loja;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notas_entrada_loja'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notas_entrada_loja;
  END IF;
END $$;
