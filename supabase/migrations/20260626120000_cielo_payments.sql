-- Auditoria de pagamentos Cielo (gateway oficial FinMemory).

CREATE TABLE IF NOT EXISTS public.cielo_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  merchant_order_id text NOT NULL,
  cielo_payment_id text,
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  description text,
  payment_method text NOT NULL DEFAULT 'pix'
    CHECK (payment_method IN ('pix', 'credit_card')),
  cielo_status integer,
  return_code text,
  return_message text,
  finmemory_status text NOT NULL DEFAULT 'pending'
    CHECK (finmemory_status IN (
      'pending', 'authorized', 'paid', 'denied',
      'cancelled', 'refunded', 'aborted', 'unknown'
    )),
  environment text NOT NULL DEFAULT 'sandbox'
    CHECK (environment IN ('sandbox', 'production')),
  raw_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cielo_payments_merchant_order_id
  ON public.cielo_payments (merchant_order_id);

CREATE INDEX IF NOT EXISTS idx_cielo_payments_user_created
  ON public.cielo_payments (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cielo_payments_cielo_payment_id
  ON public.cielo_payments (cielo_payment_id)
  WHERE cielo_payment_id IS NOT NULL;

COMMENT ON TABLE public.cielo_payments IS
  'Registro auditável de transações Cielo eCommerce (PaymentId, status, ReturnCode).';

ALTER TABLE public.cielo_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY cielo_payments_select_own ON public.cielo_payments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Inserções/atualizações apenas via service role (API backend).
