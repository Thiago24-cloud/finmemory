-- Snapshot opcional do estado do mascote (auditoria / A-B). O runtime usa sinais leves no cliente.
CREATE TABLE IF NOT EXISTS public.character_engine_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  current_state text NOT NULL,
  mood_level text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_character_engine_snapshots_user_created
  ON public.character_engine_snapshots(user_id, created_at DESC);

COMMENT ON TABLE public.character_engine_snapshots IS
  'Histórico opcional do Character Engine (FinMemory). Cálculo principal é client-side + API leve.';
