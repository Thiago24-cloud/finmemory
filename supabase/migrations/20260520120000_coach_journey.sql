-- Jornada guiada contínua: intro progressiva + reengajamento por feature (consumidor).
-- Também usado pela jornada gamificada Caça-Preço (hints_dismissed.caca_preco_map).

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS coach_journey JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.users.coach_journey IS
  'Intro progressiva (intro_completed), uso de features (feature_last_used), última dica (last_coach_shown_at, hints_dismissed).';
