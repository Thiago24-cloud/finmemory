-- Stripe Connect (lojistas) + pagamento de pedidos pick-up.

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id text,
  ADD COLUMN IF NOT EXISTS stripe_connect_charges_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connect_payouts_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connect_onboarded_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stores_stripe_connect_account_id
  ON public.stores (stripe_connect_account_id)
  WHERE stripe_connect_account_id IS NOT NULL;

COMMENT ON COLUMN public.stores.stripe_connect_account_id IS 'Stripe Connect Express account (acct_...) da loja.';
COMMENT ON COLUMN public.stores.stripe_connect_charges_enabled IS 'Stripe account.charges_enabled — pode receber pagamentos.';

ALTER TABLE public.pedidos_loja
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'paid',
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

ALTER TABLE public.pedidos_loja
  DROP CONSTRAINT IF EXISTS pedidos_loja_payment_status_check;

ALTER TABLE public.pedidos_loja
  ADD CONSTRAINT pedidos_loja_payment_status_check
  CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded', 'cancelled'));

COMMENT ON COLUMN public.pedidos_loja.payment_status IS
  'pending = aguardando Checkout; paid = liberado para a loja; cancelled = checkout expirado/cancelado.';

CREATE INDEX IF NOT EXISTS idx_pedidos_loja_payment_pending
  ON public.pedidos_loja (payment_status, criado_em DESC)
  WHERE payment_status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS idx_pedidos_loja_stripe_checkout_session
  ON public.pedidos_loja (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;
