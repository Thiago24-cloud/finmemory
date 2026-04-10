-- find_or_create_store: match por CNPJ (14 dígitos) antes de nome/endereço+200m.
-- Depende de: public.stores.cnpj + idx_stores_cnpj_normalized_unique (20260328120000).

DROP FUNCTION IF EXISTS public.find_or_create_store(text, text, double precision, double precision);

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

  -- Camada 0: CNPJ com 14 dígitos — mesma unidade (evita segunda linha por coords/nome)
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
  END IF;

  -- Camada 1: ≤200 m + similarity de nome
  SELECT s.id INTO v_found
  FROM public.stores s
  WHERE coalesce(s.active, true) = true
    AND s.lat IS NOT NULL
    AND s.lng IS NOT NULL
    AND st_dwithin(
      st_setsrid(st_makepoint(s.lng, s.lat), 4326)::geography,
      v_point,
      200
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

  -- Camada 2: ≤200 m + endereço (pg_trgm)
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
        200
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

  -- Camada 3: nova loja
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
  'Deduplica lojas: (0) CNPJ 14 dígitos (1) nome+200m+similarity>0,6 (2) endereço+200m+similarity>0,45 (3) insert needs_review=true.';

GRANT EXECUTE ON FUNCTION public.find_or_create_store(text, text, double precision, double precision, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.find_or_create_store(text, text, double precision, double precision, text)
  TO authenticated;
