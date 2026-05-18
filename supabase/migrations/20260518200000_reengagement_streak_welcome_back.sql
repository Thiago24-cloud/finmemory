-- Reengajamento: login, streak freeze, welcome back, push log

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS streak_freeze_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_streak_update timestamptz,
  ADD COLUMN IF NOT EXISTS welcome_back_bonus_until date,
  ADD COLUMN IF NOT EXISTS welcome_back_last_shown_at timestamptz;

COMMENT ON COLUMN public.users.last_login_at IS 'Último acesso ao app (login ou sessão ativa).';
COMMENT ON COLUMN public.users.streak_freeze_count IS 'Escudos que preservam a ofensiva após 48h+ sem entrar.';
COMMENT ON COLUMN public.users.last_streak_update IS 'Última atualização da ofensiva (controle de fuso).';
COMMENT ON COLUMN public.users.streak_current IS 'current_streak — dias consecutivos de acesso.';
COMMENT ON COLUMN public.users.streak_max IS 'longest_streak — recorde histórico.';
COMMENT ON COLUMN public.users.streak_last_action_date IS 'Data (America/Sao_Paulo) da última contagem de streak.';
COMMENT ON COLUMN public.users.welcome_back_bonus_until IS 'Data (BR) em que missões dão XP em dobro (retorno após 48h).';
COMMENT ON COLUMN public.users.welcome_back_last_shown_at IS 'Última exibição do modal Welcome Back.';

CREATE TABLE IF NOT EXISTS public.user_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'onesignal',
  token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider, token)
);

CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_id ON public.user_push_tokens(user_id);

CREATE TABLE IF NOT EXISTS public.reengagement_push_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  campaign text NOT NULL DEFAULT 'inactive_48h',
  sent_at timestamptz NOT NULL DEFAULT now(),
  success boolean NOT NULL DEFAULT false,
  provider text,
  error_message text
);

CREATE INDEX IF NOT EXISTS idx_reengagement_push_log_user_campaign
  ON public.reengagement_push_log(user_id, campaign, sent_at DESC);
