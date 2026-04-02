-- Conexões Open Finance (Pluggy): um registo por utilizador + item Pluggy.
-- user_id alinha-se ao resto do app: public.users.id (session.user.supabaseId).

CREATE TABLE IF NOT EXISTS public.bank_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bank_connections_user_item_unique UNIQUE (user_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_bank_connections_user_id ON public.bank_connections(user_id);

ALTER TABLE public.bank_connections ENABLE ROW LEVEL SECURITY;

-- Leitura apenas dos próprios registos (mesmo padrão de cobrancas: auth.uid() = user_id em clientes Supabase Auth)
CREATE POLICY "Users can view own bank_connections"
  ON public.bank_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bank_connections"
  ON public.bank_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bank_connections"
  ON public.bank_connections FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own bank_connections"
  ON public.bank_connections FOR DELETE
  USING (auth.uid() = user_id);
