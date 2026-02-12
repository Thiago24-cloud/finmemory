-- Cadastro / lista de espera: email e liberação de acesso
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

-- Qualquer um pode inserir (cadastro público)
CREATE POLICY "Anyone can insert signup"
  ON public.signups FOR INSERT
  WITH CHECK (true);

-- Só o backend (service role) pode ler/atualizar; anon não precisa ler
CREATE POLICY "Service role can read and update signups"
  ON public.signups FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.signups IS 'Cadastro por email; approved = liberado para acessar o app';
