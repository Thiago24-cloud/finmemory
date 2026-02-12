-- Corrige: app não conseguia LER a tabela signups (RLS bloqueava).
-- Execute no SQL Editor do Supabase.
-- IMPORTANTE: a tabela public.signups precisa já existir (rode supabase-signups.sql ou supabase-signups-completo.sql antes).

-- Remove política antiga (pode ter nome com espaços)
DROP POLICY IF EXISTS "Anyone can read signups" ON public.signups;

-- Cria política com nome sem espaços (mais compatível)
DROP POLICY IF EXISTS signups_allow_select ON public.signups;
CREATE POLICY signups_allow_select
  ON public.signups FOR SELECT
  USING (true);
