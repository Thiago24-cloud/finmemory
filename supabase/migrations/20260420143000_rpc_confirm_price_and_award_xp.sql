-- RPC centralizada: confirmação diária + XP (substitui lógica em confirm-offer-seen.js).
-- UNIQUE em coluna/expressão deve ser índice único (não ALTER TABLE ... UNIQUE com expressão — erro 42601 no PG).

-- Limpa tentativa falha de CONSTRAINT com o mesmo nome / índice antigo
ALTER TABLE public.price_confirmations DROP CONSTRAINT IF EXISTS price_confirmations_user_offer_sp_day_uq;
DROP INDEX IF EXISTS public.price_confirmations_user_offer_sp_day_uq;

CREATE UNIQUE INDEX price_confirmations_user_offer_sp_day_uq
  ON public.price_confirmations (
    app_user_id,
    establishment_id,
    source,
    offer_key,
    ((timezone('America/Sao_Paulo', created_at))::date)
  );

CREATE OR REPLACE FUNCTION public.confirm_price_and_award_xp(
  p_user_id uuid,
  p_establishment_id uuid,
  p_source text,
  p_offer_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row_id uuid;
  v_new_xp integer;
  v_new_level integer;
  v_curr_xp integer;
  v_curr_level integer;
BEGIN
  IF p_user_id IS NULL OR p_establishment_id IS NULL OR p_source IS NULL OR trim(p_offer_key) = '' THEN
    RETURN jsonb_build_object(
      'error', 'missing_params',
      'xp_awarded', 0,
      'new_xp', NULL::integer,
      'new_level', NULL::integer
    );
  END IF;

  IF p_source NOT IN ('price_points', 'agent_promotion', 'encarte') THEN
    RETURN jsonb_build_object(
      'error', 'invalid_source',
      'xp_awarded', 0,
      'new_xp', NULL::integer,
      'new_level', NULL::integer
    );
  END IF;

  SELECT u.xp_points, u.level
    INTO v_curr_xp, v_curr_level
  FROM public.users u
  WHERE u.id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'error', 'user_not_found',
      'xp_awarded', 0,
      'new_xp', NULL::integer,
      'new_level', NULL::integer
    );
  END IF;

  -- Inferência do índice único (mesma expressão que no CREATE UNIQUE INDEX)
  INSERT INTO public.price_confirmations (app_user_id, establishment_id, source, offer_key, created_at)
  VALUES (p_user_id, p_establishment_id, p_source, trim(p_offer_key), now())
  ON CONFLICT (
    app_user_id,
    establishment_id,
    source,
    offer_key,
    ((timezone('America/Sao_Paulo', created_at))::date)
  )
  DO NOTHING
  RETURNING id INTO v_row_id;

  IF v_row_id IS NULL THEN
    RETURN jsonb_build_object(
      'xp_awarded', 0,
      'new_xp', COALESCE(v_curr_xp, 0),
      'new_level', COALESCE(v_curr_level, 1)
    );
  END IF;

  UPDATE public.users u
  SET
    xp_points = u.xp_points + 10,
    contributions_count = u.contributions_count + 1,
    level = GREATEST(
      1,
      FLOOR((u.xp_points + 10) / 100.0)::integer + 1
    )
  WHERE u.id = p_user_id
  RETURNING u.xp_points, u.level INTO v_new_xp, v_new_level;

  IF NOT FOUND THEN
    DELETE FROM public.price_confirmations WHERE id = v_row_id;
    RETURN jsonb_build_object(
      'error', 'user_update_failed',
      'xp_awarded', 0,
      'new_xp', COALESCE(v_curr_xp, 0),
      'new_level', COALESCE(v_curr_level, 1)
    );
  END IF;

  RETURN jsonb_build_object(
    'xp_awarded', 10,
    'new_xp', v_new_xp,
    'new_level', COALESCE(v_new_level, 1)
  );
END;
$$;

COMMENT ON FUNCTION public.confirm_price_and_award_xp(uuid, uuid, text, text) IS
  'Insere price_confirmations (1/dia SP); se novo, +10 XP em users e recalcula level.';

REVOKE ALL ON FUNCTION public.confirm_price_and_award_xp(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_price_and_award_xp(uuid, uuid, text, text) TO service_role;
