-- Missões diárias: catálogo fixo + completions por usuário/dia.

CREATE TABLE IF NOT EXISTS public.daily_missions (
  id          text PRIMARY KEY,           -- ex.: 'scan_3', 'log_expense', etc.
  icon        text NOT NULL DEFAULT '⭐',
  title       text NOT NULL,
  description text,
  xp_reward   integer NOT NULL DEFAULT 20,
  total_steps integer NOT NULL DEFAULT 1, -- quantas vezes precisa fazer a ação
  sort_order  integer NOT NULL DEFAULT 0,
  active      boolean NOT NULL DEFAULT true
);

INSERT INTO public.daily_missions (id, icon, title, description, xp_reward, total_steps, sort_order) VALUES
  ('scan_3',       '🛒', 'Escaneie 3 produtos',       'Use o scanner no supermercado',  50, 3, 1),
  ('log_expense',  '📊', 'Registre uma despesa',       'Adicione um gasto manualmente',  20, 1, 2),
  ('find_cheaper', '🗺️', 'Encontre o menor preço',     'Confirme um preço no mapa',      75, 1, 3),
  ('invite_friend','👥', 'Convide um amigo',           'Compartilhe seu link de convite',150, 1, 4)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.user_mission_completions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  mission_id  text NOT NULL REFERENCES public.daily_missions (id) ON DELETE CASCADE,
  steps_done  integer NOT NULL DEFAULT 0,
  completed   boolean NOT NULL DEFAULT false,
  mission_date date NOT NULL,             -- data BR (America/Sao_Paulo)
  completed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_mission_date
  ON public.user_mission_completions (user_id, mission_id, mission_date);

CREATE INDEX IF NOT EXISTS idx_umc_user_date
  ON public.user_mission_completions (user_id, mission_date DESC);

ALTER TABLE public.user_mission_completions ENABLE ROW LEVEL SECURITY;
-- Acesso exclusivo via service role (API Next.js).
