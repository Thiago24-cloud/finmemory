-- =============================================================================
-- Demo / seed: uma oferta por rede (slug) em promocoes_supermercados — FinMemory mapa
-- Slugs alinhados a lib/mapStoreChainMatch.js (storeNormalizedMatchesChainSlug).
--
-- Regras:
-- - Lat/lng: primeiro tenta a PRIMEIRA loja ativa em public.stores cujo nome casa
--   com a rede; senão usa coordenadas de referência em SP (ajuste se quiser).
-- - Oferta só aparece no PIN se a loja real estiver a ≤ ~1,25–2,5 km do ponto
--   (API store-offers). Se não tiveres loja dessa rede em stores, só verás no
--   filtro global / outras vistas — não no pin específico.
-- - Para dados reais, use os ficheiros curadoria por rede (sacolao-*, pomar-*, etc.).
--
-- Idempotência: apaga linhas com este ingest_source e reinsere.
-- Cole no SQL Editor (role com INSERT; RLS pode exigir service_role).
-- =============================================================================

DELETE FROM public.promocoes_supermercados
WHERE ingest_source = 'demo_seed:redes_mapa:v1';

-- Ajuste run_id se a tua coluna for timestamptz (troca por now()).
INSERT INTO public.promocoes_supermercados (
  supermercado,
  nome_produto,
  preco,
  categoria,
  lat,
  lng,
  run_id,
  atualizado_em,
  expira_em,
  ativo,
  validade,
  ingest_source
)
SELECT
  x.slug,
  x.nome_produto,
  x.preco,
  x.categoria,
  COALESCE(st.lat, x.lat_fb)::double precision,
  COALESCE(st.lng, x.lng_fb)::double precision,
  x.run_id,
  timezone('America/Sao_Paulo', now()),
  '2026-12-31 23:59:59-03:00'::timestamptz,
  true,
  '2026-12-31'::date,
  'demo_seed:redes_mapa:v1'
FROM (
  VALUES
    -- slug, nome_produto, preco, categoria, lat_fb, lng_fb, run_id, padrão WHERE stores
    ('armazemdocampo', 'Arroz Tio João 5 kg (demo rede)', 24.90, 'Mercearia', -23.5700::float8, -46.6900::float8, 'demo-redes-map-v1', 'armazem'),
    ('paodeacucar', 'Leite Parmalat 1 L (demo rede)', 5.99, 'Laticínios', -23.5679::float8, -46.6483::float8, 'demo-redes-map-v1', 'pao'),
    ('saojorge', 'Banana Prata kg (demo rede)', 3.99, 'Hortifruti', -23.5505::float8, -46.6833::float8, 'demo-redes-map-v1', 'jorge'),
    ('carrefour', 'Óleo soja 900 ml (demo rede)', 6.99, 'Mercearia', -23.5600::float8, -46.6400::float8, 'demo-redes-map-v1', 'carrefour'),
    ('assai', 'Feijão carioca 1 kg (demo rede)', 6.49, 'Mercearia', -23.5500::float8, -46.6000::float8, 'demo-redes-map-v1', 'assai'),
    ('hirota', 'Café 500 g (demo rede)', 18.90, 'Mercearia', -23.5750::float8, -46.6870::float8, 'demo-redes-map-v1', 'hirota'),
    ('pomardavilavilamadalena', 'Maçã Gala kg (demo rede)', 9.99, 'Hortifruti', -23.5547::float8, -46.6912::float8, 'demo-redes-map-v1', 'pomar'),
    ('mambo', 'Iogurte natural 1 kg (demo rede)', 12.90, 'Laticínios', -23.5480::float8, -46.6380::float8, 'demo-redes-map-v1', 'mambo'),
    ('lopes', 'Pão francês kg (demo rede)', 14.90, 'Padaria', -23.5200::float8, -46.6500::float8, 'demo-redes-map-v1', 'lopes'),
    ('sonda', 'Açúcar 1 kg (demo rede)', 4.29, 'Mercearia', -23.6300::float8, -46.7200::float8, 'demo-redes-map-v1', 'sonda'),
    ('agape', 'Macarrão 500 g (demo rede)', 3.49, 'Mercearia', -23.5400::float8, -46.7000::float8, 'demo-redes-map-v1', 'agape'),
    ('padraosuper', 'Leite condensado 395 g (demo rede)', 5.99, 'Mercearia', -23.5500::float8, -46.7000::float8, 'demo-redes-map-v1', 'padrao'),
    ('dia', 'Água mineral 1,5 L (demo rede)', 2.99, 'Bebidas', -23.5530::float8, -46.6620::float8, 'demo-redes-map-v1', 'dia')
) AS x(slug, nome_produto, preco, categoria, lat_fb, lng_fb, run_id, marca)
LEFT JOIN LATERAL (
  SELECT s.lat, s.lng
  FROM public.stores s
  WHERE s.active = true
    AND s.lat IS NOT NULL
    AND s.lng IS NOT NULL
    AND (
      (x.marca = 'armazem' AND (s.name ILIKE '%armazém do campo%' OR s.name ILIKE '%armazem do campo%'))
      OR (x.marca = 'pao' AND (
           s.name ILIKE '%pão de açúcar%' OR s.name ILIKE '%pao de acucar%'
           OR s.name ILIKE '%minuto pão%' OR s.name ILIKE '%minuto pao%'
           OR s.name ILIKE '%mercado minuto%'))
      OR (x.marca = 'jorge' AND (
           s.name ILIKE '%sacolão%são jorge%' OR s.name ILIKE '%sacolao%sao jorge%'
           OR s.name ILIKE '%são jorge%' OR s.name ILIKE '%sao jorge%'))
      OR (x.marca = 'carrefour' AND (s.name ILIKE '%carrefour%' OR s.name ILIKE '%atacadão%' OR s.name ILIKE '%atacado carrefour%'))
      OR (x.marca = 'assai' AND (s.name ILIKE '%assai%' OR s.name ILIKE '%assaí%'))
      OR (x.marca = 'hirota' AND s.name ILIKE '%hirota%')
      OR (x.marca = 'pomar' AND s.name ILIKE '%pomar%' AND (s.name ILIKE '%vila%' OR s.name ILIKE '%madalena%'))
      OR (x.marca = 'mambo' AND s.name ILIKE '%mambo%')
      OR (x.marca = 'lopes' AND s.name ILIKE '%lopes%')
      OR (x.marca = 'sonda' AND s.name ILIKE '%sonda%')
      OR (x.marca = 'agape' AND (s.name ILIKE '%ágape%' OR s.name ILIKE '%agape%'))
      OR (x.marca = 'padrao' AND (
           s.name ILIKE '%supermercado padrão%' OR s.name ILIKE '%supermercado padrao%'
           OR s.name ILIKE '%mercado padrão%' OR s.name ILIKE '%mercado padrao%'
           OR (s.name ILIKE '%padrão%' AND s.type ILIKE '%super%')))
      OR (x.marca = 'dia' AND s.name ILIKE '%dia%' AND s.name NOT ILIKE '%hirota%'
           AND (s.name ILIKE '%supermercado%dia%' OR s.name ILIKE 'dia %' OR s.name ILIKE '% mercado dia%'))
    )
  ORDER BY s.name
  LIMIT 1
) st ON true;

-- Verificação rápida
SELECT supermercado, nome_produto, preco, lat, lng, expira_em
FROM public.promocoes_supermercados
WHERE ingest_source = 'demo_seed:redes_mapa:v1'
ORDER BY supermercado;
