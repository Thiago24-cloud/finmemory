-- Tour de boas-vindas no dashboard: NULL = ainda não concluiu o guia.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS onboarding_dashboard_completed_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.users.onboarding_dashboard_completed_at IS
  'Preenchido quando o utilizador conclui ou ignora o tour do dashboard; NULL = mostrar tour.';

-- Quem já existia antes desta migração não volta a ver o tour.
UPDATE public.users
SET onboarding_dashboard_completed_at = COALESCE(onboarding_dashboard_completed_at, now())
WHERE onboarding_dashboard_completed_at IS NULL;
