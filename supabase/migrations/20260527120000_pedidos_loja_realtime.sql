-- Fase 5: Supabase Realtime em pedidos_loja (painel lojista + tracking consumidor).

ALTER TABLE public.pedidos_loja REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'pedidos_loja'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos_loja;
  END IF;
END $$;

COMMENT ON TABLE public.pedidos_loja IS
  'Pedidos pick-up. Realtime habilitado (supabase_realtime) para painel e /pedido/[id].';
