-- Push de oferta relâmpago para consumidores num raio (~3 km) da loja.

CREATE TABLE IF NOT EXISTS public.user_last_locations (
  user_id uuid PRIMARY KEY REFERENCES public.users (id) ON DELETE CASCADE,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  notify_nearby_offers boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_user_last_locations_updated
  ON public.user_last_locations (updated_at DESC)
  WHERE notify_nearby_offers = true;

COMMENT ON TABLE public.user_last_locations IS
  'Última posição conhecida (mapa/app) para push de ofertas próximas.';

CREATE TABLE IF NOT EXISTS public.nearby_offer_push_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores (id) ON DELETE CASCADE,
  produto_loja_id uuid REFERENCES public.produtos_loja (id) ON DELETE SET NULL,
  campaign text NOT NULL DEFAULT 'merchant_flash',
  sent_at timestamptz NOT NULL DEFAULT now(),
  success boolean NOT NULL DEFAULT false,
  provider text,
  error_message text
);

CREATE INDEX IF NOT EXISTS idx_nearby_offer_push_log_user_store_sent
  ON public.nearby_offer_push_log (user_id, store_id, sent_at DESC);

ALTER TABLE public.user_last_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nearby_offer_push_log ENABLE ROW LEVEL SECURITY;

-- Consumidores no raio com opt-in e localização recente.
CREATE OR REPLACE FUNCTION public.usuarios_opt_in_proximos(
  p_store_lat double precision,
  p_store_lng double precision,
  p_raio_km double precision DEFAULT 3,
  p_exclude_user_id uuid DEFAULT NULL,
  p_max_location_age_hours integer DEFAULT 168
)
RETURNS TABLE (user_id uuid)
LANGUAGE sql
STABLE
AS $$
  SELECT ull.user_id
  FROM public.user_last_locations ull
  WHERE ull.notify_nearby_offers = true
    AND (p_exclude_user_id IS NULL OR ull.user_id <> p_exclude_user_id)
    AND ull.updated_at >= now() - (GREATEST(p_max_location_age_hours, 1) || ' hours')::interval
    AND ST_DWithin(
      ST_SetSRID(ST_MakePoint(ull.lng, ull.lat), 4326)::geography,
      ST_SetSRID(ST_MakePoint(p_store_lng, p_store_lat), 4326)::geography,
      GREATEST(p_raio_km, 0.1) * 1000.0
    );
$$;

COMMENT ON FUNCTION public.usuarios_opt_in_proximos IS
  'User IDs com opt-in e posição recente num raio (km) da loja — push oferta relâmpago.';

GRANT EXECUTE ON FUNCTION public.usuarios_opt_in_proximos TO service_role;
