-- Varejista: tipo de conta + histórico de lotes (estilo iFood) + itens por lote.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'consumidor';

COMMENT ON COLUMN public.users.account_type IS 'consumidor | varejista — fluxo do scanner e inventário';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_account_type_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_account_type_check
      CHECK (account_type IN ('consumidor', 'varejista'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.historico_inventario_varejo (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  nome_lote    text,
  total_itens  integer NOT NULL DEFAULT 0,
  valor_total  numeric(14, 2) NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.historico_inventario_varejo IS 'Lotes salvos pelo varejista no scanner (entrada de estoque).';

CREATE INDEX IF NOT EXISTS idx_historico_inventario_varejo_user_created
  ON public.historico_inventario_varejo (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.historico_inventario_varejo_itens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id         uuid NOT NULL REFERENCES public.historico_inventario_varejo (id) ON DELETE CASCADE,
  ean             text NOT NULL,
  nome            text NOT NULL DEFAULT '',
  quantidade      numeric(12, 3) NOT NULL DEFAULT 1,
  preco_unitario  numeric(14, 2),
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_historico_inventario_varejo_itens_lote
  ON public.historico_inventario_varejo_itens (lote_id, sort_order);

ALTER TABLE public.historico_inventario_varejo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_inventario_varejo_itens ENABLE ROW LEVEL SECURITY;
-- Leitura/escrita via API Next.js (service role), igual daily_missions.

INSERT INTO public.daily_missions (id, icon, title, description, xp_reward, total_steps, sort_order) VALUES
  ('varejo_salvar_lote',   '📦', 'Salve um lote de estoque', 'Finalize o carrinho no modo varejista', 60, 1, 5),
  ('varejo_exportar_csv', '📤', 'Exporte inventário (CSV)', 'Compartilhe um lote salvo',               40, 1, 6)
ON CONFLICT (id) DO NOTHING;
