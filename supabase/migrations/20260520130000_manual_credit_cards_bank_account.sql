-- Vincula limite manual do cartão à conta Open Finance (bank_accounts.id).

ALTER TABLE public.manual_credit_cards
  ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_manual_credit_cards_user_bank_account
  ON public.manual_credit_cards(user_id, bank_account_id)
  WHERE bank_account_id IS NOT NULL;

COMMENT ON COLUMN public.manual_credit_cards.bank_account_id IS
  'Conta OF (cartão) à qual o credit_limit se aplica; usado no simulador (limite − gasto no dashboard).';
