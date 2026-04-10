-- =============================================================================
-- Sacolão São Jorge — Vila Madalena (Rua Isabel de Castela, 33)
-- O mapa só mostra o pin se existir linha em public.stores + ofertas saojorge perto.
-- Coordenadas anteriores da curadoria (-23.5481, -46.6938) estavam ~1 km ao lado.
-- Cole no SQL Editor (Supabase).
-- =============================================================================

-- 1) Loja (idempotente: não duplica se já existir nome+endereço parecidos)
INSERT INTO public.stores (name, type, address, lat, lng, active, needs_review)
SELECT
  'Sacolão São Jorge — Vila Madalena',
  'supermarket',
  'Rua Isabel de Castela, 33 - Vila Madalena, São Paulo - SP',
  -23.5505::double precision,
  -46.6833::double precision,
  true,
  false
WHERE NOT EXISTS (
  SELECT 1
  FROM public.stores s
  WHERE s.active = true
    AND s.name ILIKE '%sacol%'
    AND s.name ILIKE '%jorge%'
    AND (
      s.address ILIKE '%isabel de castel%'
      OR s.address ILIKE '%castela%33%'
    )
);

-- 2) Alinhar ofertas da curadoria antiga (coord VM) às coordenadas corretas
UPDATE public.promocoes_supermercados
SET
  lat = -23.5505,
  lng = -46.6833
WHERE supermercado = 'saojorge'
  AND ativo = true
  AND lat IS NOT NULL
  AND lng IS NOT NULL
  AND ABS(lat - (-23.5481)) < 0.002
  AND ABS(lng - (-46.6938)) < 0.02;
