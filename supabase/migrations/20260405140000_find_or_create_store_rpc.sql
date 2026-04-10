-- =============================================================================
-- Deduplicação de lojas (Waze dos Preços / ingest Instagram–GPT)
-- RPC: find_or_create_store(name, address, lat, lng)
--
-- 1) Nome normalizado + similarity (pg_trgm) > 0,6 em lojas a ≤200 m (PostGIS)
-- 2) Endereço normalizado + similarity > 0,45 nas mesmas lojas a ≤200 m
-- 3) INSERT nova linha com needs_review = true
--
-- Cria postgis e pg_trgm se ainda não existirem (Supabase costuma permitir via migração).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.stores.needs_review IS
  'true quando a loja foi criada pelo find_or_create_store sem match forte — revisar duplicatas.';

-- Ícone geográfico para ST_DWithin (ignora falha se PostGIS ainda não existir)
DO $idx$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_stores_point_geog
    ON public.stores
    USING gist (
      (st_setsrid(st_makepoint(lng, lat), 4326)::geography)
    )
    WHERE lat IS NOT NULL
      AND lng IS NOT NULL
      AND COALESCE(active, true) = true;
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE 'idx_stores_point_geog: ative a extensão postgis e volte a correr esta migração.';
  WHEN OTHERS THEN
    RAISE NOTICE 'idx_stores_point_geog: %', SQLERRM;
END
$idx$;

-- Acentos PT comuns (evita depender de unaccent no projeto)
CREATE OR REPLACE FUNCTION public._store_unaccent(t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT translate(
    coalesce(t, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
  );
$$;

CREATE OR REPLACE FUNCTION public.normalize_store_name_for_match(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT trim(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          lower(public._store_unaccent(coalesce(input, ''))),
          '\y(supermercado|hipermercado|mercado|atacado|atacadão|atacadao)\y',
          '',
          'gi'
        ),
        '[^a-z0-9\s]',
        ' ',
        'g'
      ),
      '\s+',
      ' ',
      'g'
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.normalize_address_for_match(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT trim(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                regexp_replace(
                  lower(public._store_unaccent(coalesce(input, ''))),
                  '\yav\.?\s*',
                  'avenida ',
                  'gi'
                ),
                '\yr\.?\s*',
                'rua ',
                'gi'
              ),
              '\yest\.?\s*',
              'estrada ',
              'gi'
            ),
            '\yal\.?\s*',
            'alameda ',
            'gi'
          ),
          '\ytv\.?\s*',
          'travessa ',
          'gi'
        ),
        '[^a-z0-9\s]',
        ' ',
        'g'
      ),
      '\s+',
      ' ',
      'g'
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.find_or_create_store(
  p_name text,
  p_address text,
  p_lat double precision,
  p_lng double precision
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
    needs_review
  )
  VALUES (
    v_name_in,
    'supermarket',
    v_addr_in,
    p_lat,
    p_lng,
    true,
    true
  )
  RETURNING id INTO v_found;

  store_id := v_found;
  created_new := true;
  matched_by := 'inserted';
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.find_or_create_store(text, text, double precision, double precision) IS
  'Deduplica lojas: (1) nome+200m+similarity>0,6 (2) endereço+200m+similarity>0,45 (3) insert needs_review=true.';

GRANT EXECUTE ON FUNCTION public.find_or_create_store(text, text, double precision, double precision)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.find_or_create_store(text, text, double precision, double precision)
  TO authenticated;
