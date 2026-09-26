-- Preferência de produto/plano para entrada do app (teste alinhado à landing).
-- Não substitui Stripe: trial local em preferred_* / plan_trial_ends_at.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS preferred_audience text,
  ADD COLUMN IF NOT EXISTS preferred_plan text,
  ADD COLUMN IF NOT EXISTS plan_trial_ends_at timestamptz;

COMMENT ON COLUMN public.users.preferred_audience IS
  'consumer | merchant — linha de produto escolhida no hub /inicio';
COMMENT ON COLUMN public.users.preferred_plan IS
  'Plano em teste: free|plus|pro|familia (B2C) ou store plan_code (B2B)';
COMMENT ON COLUMN public.users.plan_trial_ends_at IS
  'Fim do trial local (sem Stripe). Null = sem trial de preferência.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_preferred_audience_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_preferred_audience_check
      CHECK (
        preferred_audience IS NULL
        OR preferred_audience IN ('consumer', 'merchant')
      );
  END IF;
END $$;
