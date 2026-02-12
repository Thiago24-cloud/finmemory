-- Cadastro por email (lista de espera / liberação de acesso)
-- Execute no SQL Editor do Supabase se não usar migrations

CREATE TABLE IF NOT EXISTS public.signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  approved BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signups_email ON public.signups(email);
CREATE INDEX IF NOT EXISTS idx_signups_approved ON public.signups(approved);
CREATE INDEX IF NOT EXISTS idx_signups_created_at ON public.signups(created_at DESC);

ALTER TABLE public.signups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert signup" ON public.signups;
CREATE POLICY "Anyone can insert signup"
  ON public.signups FOR INSERT
  WITH CHECK (true);

-- Leitura: qualquer um pode ler (necessário para o app verificar se email está cadastrado)
DROP POLICY IF EXISTS "Anyone can read signups" ON public.signups;
CREATE POLICY "Anyone can read signups"
  ON public.signups FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Service role can read and update signups" ON public.signups;
CREATE POLICY "Service role can read and update signups"
  ON public.signups FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.signups IS 'Cadastro por email; approved = liberado para acessar o app';
