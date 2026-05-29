-- Cole no SQL Editor do Supabase (sync produtos/ofertas celular ↔ desktop no painel Parceiros).

ALTER TABLE public.produtos_loja REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'produtos_loja'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.produtos_loja;
  END IF;
END $$;
