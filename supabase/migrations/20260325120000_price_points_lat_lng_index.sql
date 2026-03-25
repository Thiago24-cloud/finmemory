-- Acelera consultas do mapa com filtro por retângulo (bbox) em lat/lng.
CREATE INDEX IF NOT EXISTS idx_price_points_lat_lng_partial
  ON public.price_points (lat, lng)
  WHERE lat IS NOT NULL AND lng IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_promocoes_supermercados_lat_lng_active
  ON public.promocoes_supermercados (lat, lng)
  WHERE lat IS NOT NULL AND lng IS NOT NULL AND ativo = true;
