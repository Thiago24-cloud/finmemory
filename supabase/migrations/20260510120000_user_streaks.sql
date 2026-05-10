-- Streak diário: sequência de dias consecutivos com atividade no app.
-- Incrementado via API quando o usuário realiza qualquer ação gamificada.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS streak_current integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS streak_max     integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS streak_last_action_date date;

COMMENT ON COLUMN public.users.streak_current IS 'Dias consecutivos com atividade gamificada.';
COMMENT ON COLUMN public.users.streak_max     IS 'Maior sequência histórica.';
COMMENT ON COLUMN public.users.streak_last_action_date IS 'Última data (America/Sao_Paulo) em que o streak foi atualizado.';
