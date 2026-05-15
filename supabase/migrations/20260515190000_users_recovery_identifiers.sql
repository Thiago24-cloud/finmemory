-- Recuperação de conta: telefone nacional e CPF (apenas dígitos), únicos por utilizador credentials.
ALTER TABLE IF EXISTS public.users
  ADD COLUMN IF NOT EXISTS recovery_phone_digits VARCHAR(13),
  ADD COLUMN IF NOT EXISTS recovery_document_digits VARCHAR(11),
  ADD COLUMN IF NOT EXISTS recovery_identifier_collected_at TIMESTAMPTZ;

COMMENT ON COLUMN public.users.recovery_phone_digits IS 'Telefone Brasil normalizado só dígitos (10–11 sem +55)';
COMMENT ON COLUMN public.users.recovery_document_digits IS 'CPF apenas dígitos (11)';
COMMENT ON COLUMN public.users.recovery_identifier_collected_at IS 'Utilizador concluiu onboarding de telefone ou CPF';

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_recovery_phone_digits
  ON public.users (recovery_phone_digits)
  WHERE recovery_phone_digits IS NOT NULL AND recovery_phone_digits <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_recovery_document_digits
  ON public.users (recovery_document_digits)
  WHERE recovery_document_digits IS NOT NULL AND recovery_document_digits <> '';

-- Credenciais: novos registos já entram sem bloqueio de email (signup define verified).
-- Opcionalmente desbloqueia contas antigas que nunca clicaram em verificar.
UPDATE public.auth_local_users
SET email_verified_at = NOW()
WHERE email_verified_at IS NULL;
