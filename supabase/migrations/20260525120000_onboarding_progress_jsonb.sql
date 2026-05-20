-- Progresso do onboarding gamificado (chaves JSONB).
-- FinMemory: sessão NextAuth → public.users.id (recomendado abaixo).
-- Opcional: espelho em public.profiles (auth.users) se usar Supabase Auth nativo.

-- ---------------------------------------------------------------------------
-- A) public.users (FinMemory / NextAuth — use ESTE no SQL Editor do projeto)
-- ---------------------------------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS onboarding_progress JSONB;

COMMENT ON COLUMN public.users.onboarding_progress IS
  'Flags do tutorial: home_intro, first_receipt_scanned, map_opened, stock_replenishment_seen, etc.';

-- Inicializa quem já tem tour antigo concluído
UPDATE public.users
SET onboarding_progress = COALESCE(
  onboarding_progress,
  jsonb_build_object(
    'home_intro', onboarding_dashboard_completed_at IS NOT NULL,
    'first_receipt_scanned', false,
    'map_opened', false,
    'stock_replenishment_seen', false
  )
)
WHERE onboarding_progress IS NULL;

CREATE OR REPLACE FUNCTION public.update_user_onboarding_progress(
  p_user_id UUID,
  p_key TEXT,
  p_value BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_default JSONB := '{
    "home_intro": false,
    "first_receipt_scanned": false,
    "map_opened": false,
    "stock_replenishment_seen": false
  }'::jsonb;
  v_current JSONB;
  v_updated JSONB;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id_required';
  END IF;

  IF p_key IS NULL OR p_key !~ '^[a-z][a-z0-9_]{0,63}$' THEN
    RAISE EXCEPTION 'invalid_key';
  END IF;

  SELECT COALESCE(onboarding_progress, v_default)
  INTO v_current
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  v_updated := jsonb_set(v_current, ARRAY[p_key], to_jsonb(COALESCE(p_value, true)), true);

  UPDATE public.users
  SET onboarding_progress = v_updated
  WHERE id = p_user_id;

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.update_user_onboarding_progress(UUID, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_user_onboarding_progress(UUID, TEXT, BOOLEAN) TO service_role;

-- ---------------------------------------------------------------------------
-- B) public.profiles (opcional — auth.users; corrige WHERE id = user_id do rascunho)
-- ---------------------------------------------------------------------------
DO $profiles_block$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE NOTICE 'public.profiles não existe — bloco B ignorado.';
    RETURN;
  END IF;

  ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS onboarding_progress JSONB;

  UPDATE public.profiles
  SET onboarding_progress = '{
    "home_intro": false,
    "first_receipt_scanned": false,
    "map_opened": false,
    "stock_replenishment_seen": false
  }'::jsonb
  WHERE onboarding_progress IS NULL;
END;
$profiles_block$;

CREATE OR REPLACE FUNCTION public.update_onboarding_progress(
  p_key TEXT,
  p_value BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_default JSONB := '{
    "home_intro": false,
    "first_receipt_scanned": false,
    "map_opened": false,
    "stock_replenishment_seen": false
  }'::jsonb;
  v_current JSONB;
  v_updated JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_key IS NULL OR p_key !~ '^[a-z][a-z0-9_]{0,63}$' THEN
    RAISE EXCEPTION 'invalid_key';
  END IF;

  -- CORREÇÃO: filtrar por profiles.user_id (= auth.uid()), NÃO por profiles.id
  SELECT COALESCE(onboarding_progress, v_default)
  INTO v_current
  FROM public.profiles
  WHERE user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  v_updated := jsonb_set(v_current, ARRAY[p_key], to_jsonb(COALESCE(p_value, true)), true);

  UPDATE public.profiles
  SET onboarding_progress = v_updated,
      updated_at = now()
  WHERE user_id = v_uid;

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.update_onboarding_progress(TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_onboarding_progress(TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_onboarding_progress(TEXT, BOOLEAN) TO service_role;
