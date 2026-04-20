-- Bloqueio de coordenadas erradas no mapa + proteção de logo manual.
-- 1) map_pin_location_suppressions: não listar pin / não reativar CNPJ / não inserir loja nova no mesmo “bolo”.
-- 2) map_store_logo_cache.manual_locked: painel marca logo como intocável por futuros upserts não-manuais.

CREATE TABLE IF NOT EXISTS public.map_pin_location_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_norm_key_js text NOT NULL,
  store_norm_name_sql text NOT NULL,
  center_lat double precision NOT NULL,
  center_lng double precision NOT NULL,
  radius_m double precision NOT NULL DEFAULT 280,
  note text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_map_pin_suppressions_expires
  ON public.map_pin_location_suppressions (expires_at);

COMMENT ON TABLE public.map_pin_location_suppressions IS
  'Bloqueia pin no mapa e impede find_or_create_store de reativar/inserir na mesma área para o mesmo nome (normalizado).';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'map_store_logo_cache'
  ) THEN
    ALTER TABLE public.map_store_logo_cache
      ADD COLUMN IF NOT EXISTS manual_locked boolean NOT NULL DEFAULT false;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.is_map_pin_location_suppressed(
  p_store_norm_name_sql text,
  p_lat double precision,
  p_lng double precision
) RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.map_pin_location_suppressions sup
    WHERE (sup.expires_at IS NULL OR sup.expires_at > now())
      AND sup.store_norm_name_sql = p_store_norm_name_sql
      AND p_lat IS NOT NULL
      AND p_lng IS NOT NULL
      AND st_dwithin(
        st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
        st_setsrid(st_makepoint(sup.center_lng, sup.center_lat), 4326)::geography,
        sup.radius_m
      )
  );
$$;

COMMENT ON FUNCTION public.is_map_pin_location_suppressed IS
  'true se (lat,lng) está dentro do raio de uma supressão ativa para o nome SQL-normalizado.';

CREATE OR REPLACE FUNCTION public.find_or_create_store(
  p_name text,
  p_address text,
  p_lat double precision,
  p_lng double precision,
  p_cnpj text DEFAULT NULL
)
RETURNS TABLE (
  store_id uuid,
  created_new boolean,
  matched_by text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm_name text;
  v_norm_addr text;
  v_found uuid;
  v_point geography;
  v_name_in text := nullif(trim(coalesce(p_name, '')), '');
  v_addr_in text := nullif(trim(coalesce(p_address, '')), '');
  v_cnpj_digits text;
  v_radius_m double precision := 400;
  v_slat double precision;
  v_slng double precision;
  v_inactive_id uuid;
  v_inactive_name text;
BEGIN
  IF v_name_in IS NULL THEN
    RAISE EXCEPTION 'find_or_create_store: name is required';
  END IF;

  IF p_lat IS NULL
     OR p_lng IS NULL
     OR p_lat < -90
     OR p_lat > 90
     OR p_lng < -180
     OR p_lng > 180 THEN
    RAISE EXCEPTION 'find_or_create_store: valid lat/lng are required';
  END IF;

  v_norm_name := public.normalize_store_name_for_match(v_name_in);
  v_norm_addr := public.normalize_address_for_match(coalesce(v_addr_in, ''));

  IF length(v_norm_name) < 2 THEN
    RAISE EXCEPTION 'find_or_create_store: name too short after normalization';
  END IF;

  v_point := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
  v_cnpj_digits := regexp_replace(coalesce(p_cnpj, ''), '\D', '', 'g');

  IF length(v_cnpj_digits) = 14 THEN
    SELECT s.id INTO v_found
    FROM public.stores s
    WHERE coalesce(s.active, true) = true
      AND length(regexp_replace(coalesce(s.cnpj, ''), '\D', '', 'g')) = 14
      AND regexp_replace(coalesce(s.cnpj, ''), '\D', '', 'g') = v_cnpj_digits
    LIMIT 1;

    IF v_found IS NOT NULL THEN
      store_id := v_found;
      created_new := false;
      matched_by := 'cnpj';
      RETURN NEXT;
      RETURN;
    END IF;

    SELECT s.id, s.lat, s.lng, s.name
    INTO v_inactive_id, v_slat, v_slng, v_inactive_name
    FROM public.stores s
    WHERE coalesce(s.active, true) = false
      AND length(regexp_replace(coalesce(s.cnpj, ''), '\D', '', 'g')) = 14
      AND regexp_replace(coalesce(s.cnpj, ''), '\D', '', 'g') = v_cnpj_digits
    LIMIT 1;

    IF v_inactive_id IS NOT NULL THEN
      IF NOT public.is_map_pin_location_suppressed(
        public.normalize_store_name_for_match(v_inactive_name),
        v_slat,
        v_slng
      ) THEN
        UPDATE public.stores
        SET active = true, needs_review = true
        WHERE id = v_inactive_id;

        store_id := v_inactive_id;
        created_new := false;
        matched_by := 'cnpj_reactivated';
        RETURN NEXT;
        RETURN;
      END IF;
    END IF;
  END IF;

  SELECT s.id INTO v_found
  FROM public.stores s
  WHERE coalesce(s.active, true) = true
    AND s.lat IS NOT NULL
    AND s.lng IS NOT NULL
    AND st_dwithin(
      st_setsrid(st_makepoint(s.lng, s.lat), 4326)::geography,
      v_point,
      v_radius_m
    )
    AND similarity(
      public.normalize_store_name_for_match(s.name),
      v_norm_name
    ) > 0.6
  ORDER BY
    similarity(
      public.normalize_store_name_for_match(s.name),
      v_norm_name
    ) DESC,
    st_distance(
      st_setsrid(st_makepoint(s.lng, s.lat), 4326)::geography,
      v_point
    ) ASC
  LIMIT 1;

  IF v_found IS NOT NULL THEN
    store_id := v_found;
    created_new := false;
    matched_by := 'name_proximity';
    RETURN NEXT;
    RETURN;
  END IF;

  IF length(v_norm_addr) >= 8 THEN
    SELECT s.id INTO v_found
    FROM public.stores s
    WHERE coalesce(s.active, true) = true
      AND s.lat IS NOT NULL
      AND s.lng IS NOT NULL
      AND s.address IS NOT NULL
      AND btrim(s.address) <> ''
      AND st_dwithin(
        st_setsrid(st_makepoint(s.lng, s.lat), 4326)::geography,
        v_point,
        v_radius_m
      )
      AND similarity(
        public.normalize_address_for_match(s.address),
        v_norm_addr
      ) > 0.45
    ORDER BY
      similarity(
        public.normalize_address_for_match(s.address),
        v_norm_addr
      ) DESC,
      st_distance(
        st_setsrid(st_makepoint(s.lng, s.lat), 4326)::geography,
        v_point
      ) ASC
    LIMIT 1;
  END IF;

  IF v_found IS NOT NULL THEN
    store_id := v_found;
    created_new := false;
    matched_by := 'address_fuzzy';
    RETURN NEXT;
    RETURN;
  END IF;

  IF public.is_map_pin_location_suppressed(v_norm_name, p_lat, p_lng) THEN
    RAISE EXCEPTION 'find_or_create_store: localização bloqueada para este nome (map_pin_location_suppressions). Remova a supressão no Supabase se foi engano.';
  END IF;

  INSERT INTO public.stores (
    name,
    type,
    address,
    lat,
    lng,
    active,
    needs_review,
    cnpj
  )
  VALUES (
    v_name_in,
    'supermarket',
    v_addr_in,
    p_lat,
    p_lng,
    true,
    true,
    CASE WHEN length(v_cnpj_digits) = 14 THEN v_cnpj_digits ELSE NULL END
  )
  RETURNING id INTO v_found;

  store_id := v_found;
  created_new := true;
  matched_by := 'inserted';
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.find_or_create_store(text, text, double precision, double precision, text) IS
  'Deduplica lojas; respeita map_pin_location_suppressions (sem reativar CNPJ no pin bloqueado, sem INSERT na zona).';
