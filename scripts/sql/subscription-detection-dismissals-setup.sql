-- =============================================================================
-- Assinaturas detectadas — tabela para "Remover da lista" (ignorar)
-- Cole no Supabase SQL Editor se o botão de lixeira falhar.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.subscription_detection_dismissals (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  detection_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, detection_id)
);

CREATE INDEX IF NOT EXISTS subscription_detection_dismissals_user_idx
  ON public.subscription_detection_dismissals (user_id, created_at DESC);

ALTER TABLE public.subscription_detection_dismissals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscription_dismissals_select_own" ON public.subscription_detection_dismissals;
CREATE POLICY "subscription_dismissals_select_own"
  ON public.subscription_detection_dismissals FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "subscription_dismissals_insert_own" ON public.subscription_detection_dismissals;
CREATE POLICY "subscription_dismissals_insert_own"
  ON public.subscription_detection_dismissals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "subscription_dismissals_delete_own" ON public.subscription_detection_dismissals;
CREATE POLICY "subscription_dismissals_delete_own"
  ON public.subscription_detection_dismissals FOR DELETE
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, DELETE ON public.subscription_detection_dismissals TO authenticated;
GRANT ALL ON public.subscription_detection_dismissals TO service_role;
