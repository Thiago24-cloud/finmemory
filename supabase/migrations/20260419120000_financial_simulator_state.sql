-- Estado do Simulador (planejamento) por utilizador — sincronizado via API com service role.
CREATE TABLE IF NOT EXISTS public.financial_simulator_state (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_simulator_state_updated_at
  ON public.financial_simulator_state (updated_at DESC);

ALTER TABLE public.financial_simulator_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own financial_simulator_state"
  ON public.financial_simulator_state FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own financial_simulator_state"
  ON public.financial_simulator_state FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own financial_simulator_state"
  ON public.financial_simulator_state FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own financial_simulator_state"
  ON public.financial_simulator_state FOR DELETE
  USING (auth.uid() = user_id);
