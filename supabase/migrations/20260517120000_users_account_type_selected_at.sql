-- Registra quando o usuário escolheu Consumidor vs Varejista (null = ainda não escolheu).

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS account_type_selected_at timestamptz;

COMMENT ON COLUMN public.users.account_type_selected_at IS
  'Preenchido na tela de seleção de perfil; NULL força o modal após login.';

-- Contas já existentes: não bloquear com modal (mantém account_type atual).
UPDATE public.users
SET account_type_selected_at = COALESCE(account_type_selected_at, created_at, now())
WHERE account_type_selected_at IS NULL;
