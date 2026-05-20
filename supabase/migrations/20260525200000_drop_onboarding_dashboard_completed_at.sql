-- Descontinua coluna legada; estado vive em users.onboarding_progress (JSONB).
ALTER TABLE public.users
  DROP COLUMN IF EXISTS onboarding_dashboard_completed_at;
