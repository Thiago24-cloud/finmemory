-- FinMemory Plus (Stripe): campos em public.users atualizados pelo webhook (service role).

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_status TEXT,
  ADD COLUMN IF NOT EXISTS finmemory_plus_active BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS finmemory_plus_since TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_stripe_customer_id
  ON public.users (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

COMMENT ON COLUMN public.users.stripe_customer_id IS 'Stripe Customer id (cus_...)';
COMMENT ON COLUMN public.users.stripe_subscription_id IS 'Stripe Subscription id (sub_...)';
COMMENT ON COLUMN public.users.stripe_subscription_status IS 'Stripe subscription.status (active, canceled, ...)';
COMMENT ON COLUMN public.users.finmemory_plus_active IS 'Benefício Plus ativo conforme Stripe';
COMMENT ON COLUMN public.users.finmemory_plus_since IS 'Primeira ativação Plus (não limpa em past_due)';
