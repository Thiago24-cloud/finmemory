-- ============================================================
-- Aprovar todos os emails na tabela signups (liberar acesso ao app)
-- Execute no SQL Editor do Supabase: https://supabase.com/dashboard → seu projeto → SQL Editor
-- ============================================================

UPDATE public.signups
SET approved = true
WHERE approved = false;

-- Ver quantos foram aprovados:
-- SELECT email, approved, created_at FROM public.signups ORDER BY created_at DESC;
