-- Coordenadas da loja (para cruzar com o mapa / public.stores)

ALTER TABLE public.promocoes_supermercados
  ADD COLUMN IF NOT EXISTS lat DECIMAL(10, 7),
  ADD COLUMN IF NOT EXISTS lng DECIMAL(10, 7);
