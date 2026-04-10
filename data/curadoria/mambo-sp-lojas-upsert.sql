-- =============================================================================
-- Mambo — 6 filiais SP (alinhado a data/curadoria/mambo-sp-lojas.json)
-- Cole no SQL Editor do Supabase.
--
-- Objetivo:
-- 1) Garantir pins em public.stores com nome contendo "Mambo" (match do agente).
-- 2) O finmemory-agent já faz fan-out: redes em FANOUT_CHAINS (inclui mambo) —
--    ofertas sem lat/lng viram uma cópia por loja retornada por getAllStoresForChain.
--
-- Depois: na raiz, com .env do agente: npm run promo:regional  ou  cd finmemory-agent && node agent.js --only=mambo
-- =============================================================================

-- Ver o que já existe
-- SELECT id, name, address, lat, lng, active, place_id FROM public.stores WHERE name ILIKE '%mambo%' ORDER BY name;

INSERT INTO public.stores (name, type, address, lat, lng, radius_meters, place_id, neighborhood, city, active)
SELECT v.name, 'supermarket', v.address, v.lat, v.lng, 100, v.place_id, v.neighborhood, 'São Paulo', true
FROM (VALUES
  ('Mambo Brooklin', 'Avenida Vereador José Diniz, 2329 - Santo Amaro, São Paulo - SP, 04603-001', -23.6249644::double precision, -46.6830379::double precision, 'manual-mambo-brooklin-jose-diniz-2329', 'Brooklin'),
  ('Mambo Morumbi', 'Avenida Giovanni Gronchi, 2799 - Morumbi, São Paulo - SP, 05651-002', -23.6064089, -46.7250062, 'manual-mambo-morumbi-gronchi-2799', 'Morumbi'),
  ('Mambo Vila Madalena', 'Rua Deputado Lacerda Franco, 553 - Pinheiros, São Paulo - SP, 05418-001', -23.5606538, -46.6928092, 'manual-mambo-vm-lacerda-franco-553', 'Pinheiros'),
  ('Mambo Vila Romana', 'Rua Aurélia, 1973 - Vila Romana, São Paulo - SP, 05046-000', -23.5394445, -46.6971548, 'manual-mambo-vila-romana-aurelia-1973', 'Vila Romana'),
  ('Mambo Higienópolis', 'Avenida Angélica, 546 - Santa Cecília, São Paulo - SP, 01228-000', -23.5458958, -46.6577897, 'manual-mambo-higienopolis-angelica-546', 'Higienópolis'),
  ('Mambo Leopoldina', 'Rua Aliança Liberal, 322 - Vila Leopoldina, São Paulo - SP, 05088-000', -23.5222182, -46.7250521, 'manual-mambo-leopoldina-alianca-liberal-322', 'Vila Leopoldina')
) AS v(name, address, lat, lng, place_id, neighborhood)
WHERE NOT EXISTS (
  SELECT 1 FROM public.stores s WHERE s.place_id = v.place_id
);

-- Se não existir coluna place_id, use este bloco (idempotente por nome):
/*
INSERT INTO public.stores (name, type, address, lat, lng, radius_meters, neighborhood, city, active)
SELECT v.name, 'supermarket', v.address, v.lat, v.lng, 100, v.neighborhood, 'São Paulo', true
FROM (VALUES
  ('Mambo Brooklin', 'Avenida Vereador José Diniz, 2329 - Santo Amaro, São Paulo - SP, 04603-001', -23.6249644::double precision, -46.6830379::double precision, 'Brooklin'),
  ('Mambo Morumbi', 'Avenida Giovanni Gronchi, 2799 - Morumbi, São Paulo - SP, 05651-002', -23.6064089, -46.7250062, 'Morumbi'),
  ('Mambo Vila Madalena', 'Rua Deputado Lacerda Franco, 553 - Pinheiros, São Paulo - SP, 05418-001', -23.5606538, -46.6928092, 'Pinheiros'),
  ('Mambo Vila Romana', 'Rua Aurélia, 1973 - Vila Romana, São Paulo - SP, 05046-000', -23.5394445, -46.6971548, 'Vila Romana'),
  ('Mambo Higienópolis', 'Avenida Angélica, 546 - Santa Cecília, São Paulo - SP, 01228-000', -23.5458958, -46.6577897, 'Higienópolis'),
  ('Mambo Leopoldina', 'Rua Aliança Liberal, 322 - Vila Leopoldina, São Paulo - SP, 05088-000', -23.5222182, -46.7250521, 'Vila Leopoldina')
) AS v(name, address, lat, lng, neighborhood)
WHERE NOT EXISTS (SELECT 1 FROM public.stores s WHERE s.active = true AND s.name = v.name);
*/
