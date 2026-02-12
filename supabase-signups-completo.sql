-- ============================================================
-- CADASTRO (signups) - Execute TUDO no SQL Editor do Supabase
-- Cole este bloco inteiro e clique em Run.
-- ============================================================

-- 1) Criar tabela (se não existir)
CREATE TABLE IF NOT EXISTS public.signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  approved BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Índices
CREATE INDEX IF NOT EXISTS idx_signups_approved ON public.signups(approved);
CREATE INDEX IF NOT EXISTS idx_signups_created_at ON public.signups(created_at DESC);

-- 3) Ativar RLS
ALTER TABLE public.signups ENABLE ROW LEVEL SECURITY;

-- 4) Remover políticas antigas (nomes que já usamos)
DROP POLICY IF EXISTS "Anyone can insert signup" ON public.signups;
DROP POLICY IF EXISTS "Anyone can read signups" ON public.signups;
DROP POLICY IF EXISTS "Service role can read and update signups" ON public.signups;

-- 5) Política: qualquer um pode INSERIR (cadastro)
CREATE POLICY signups_allow_insert
  ON public.signups FOR INSERT
  WITH CHECK (true);

-- 6) Política: qualquer um pode LER (app verifica se email está cadastrado)
CREATE POLICY signups_allow_select
  ON public.signups FOR SELECT
  USING (true);

-- Pronto. Tabela signups com INSERT e SELECT liberados.
