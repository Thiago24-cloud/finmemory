-- Cartões cadastrados manualmente (sem número completo — só identificação e limites)
CREATE TABLE IF NOT EXISTS public.manual_credit_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  last4 TEXT,
  credit_limit NUMERIC(12, 2),
  closing_day INT CHECK (closing_day IS NULL OR (closing_day >= 1 AND closing_day <= 31)),
  due_day INT CHECK (due_day IS NULL OR (due_day >= 1 AND due_day <= 31)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manual_credit_cards_user_id ON public.manual_credit_cards(user_id);

ALTER TABLE public.manual_credit_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Frontend can manage manual_credit_cards"
  ON public.manual_credit_cards FOR ALL
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.transacoes
  ADD COLUMN IF NOT EXISTS manual_credit_card_id UUID REFERENCES public.manual_credit_cards(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transacoes_manual_credit_card_id ON public.transacoes(manual_credit_card_id);
