-- =============================================================================
-- Assinaturas detectadas — tabela para "Remover da lista" (ignorar)
-- Cole no Supabase SQL Editor se o botão de lixeira falhar.
--
-- IMPORTANTE: user_id deve referenciar public.users(id) (supabaseId da sessão),
-- NÃO auth.users. Se já criou a tabela com FK errada, rode também:
-- supabase/migrations/20260521170000_subscription_dismissals_fk_public_users.sql
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

-- Corrige FK se a tabela tiver sido criada a apontar para auth.users
ALTER TABLE public.subscription_detection_dismissals
  DROP CONSTRAINT IF EXISTS subscription_detection_dismissals_user_id_fkey;

ALTER TABLE public.subscription_detection_dismissals
  ADD CONSTRAINT subscription_detection_dismissals_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE;
