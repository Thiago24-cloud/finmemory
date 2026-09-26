-- Feedback de validação do trial (lojista disposto a pagar). Aditivo.

ALTER TABLE public.store_subscriptions
  ADD COLUMN IF NOT EXISTS willing_to_pay boolean;

ALTER TABLE public.store_subscriptions
  ADD COLUMN IF NOT EXISTS validation_notes text;

COMMENT ON COLUMN public.store_subscriptions.willing_to_pay IS
  'Lojista indicado como disposto a pagar após o trial (validação comercial).';
COMMENT ON COLUMN public.store_subscriptions.validation_notes IS
  'Notas livres da validação de 30 dias.';
