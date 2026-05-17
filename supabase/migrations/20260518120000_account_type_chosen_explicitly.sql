-- Escolha explícita na tela /escolher-perfil (não confundir com backfill de account_type_selected_at).

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS account_type_chosen_explicitly boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.account_type_chosen_explicitly IS
  'true só após o utilizador confirmar Consumidor/Varejista em /escolher-perfil';
