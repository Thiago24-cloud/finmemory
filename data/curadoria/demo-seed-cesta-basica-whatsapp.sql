-- =============================================================================
-- Demo: cesta básica SP para testar Orçamento WhatsApp (ADM)
-- Idempotente via ingest_source = demo_seed:cesta_basica_wa:v1
-- Preferência: botão "Carregar demo SP" no painel (API whatsapp-quote-seed).
-- =============================================================================

DELETE FROM public.promocoes_supermercados
WHERE ingest_source = 'demo_seed:cesta_basica_wa:v1';

INSERT INTO public.promocoes_supermercados (
  supermercado, nome_produto, preco, categoria, lat, lng,
  ativo, expira_em, validade, atualizado_em, ingest_source, run_id
)
VALUES
  ('Supermercado DIA Vila Madalena', 'Arroz tipo 1 5kg', 22.90, 'Supermercado - Promoção', -23.5532, -46.6915, true, now() + interval '14 days', CURRENT_DATE + 14, now(), 'demo_seed:cesta_basica_wa:v1', 'cesta-basica-wa-v1'),
  ('Supermercado DIA Vila Madalena', 'Feijão carioca 1kg', 7.49, 'Supermercado - Promoção', -23.5532, -46.6915, true, now() + interval '14 days', CURRENT_DATE + 14, now(), 'demo_seed:cesta_basica_wa:v1', 'cesta-basica-wa-v1'),
  ('Supermercado DIA Vila Madalena', 'Batata frita palito 400g', 12.90, 'Supermercado - Promoção', -23.5532, -46.6915, true, now() + interval '14 days', CURRENT_DATE + 14, now(), 'demo_seed:cesta_basica_wa:v1', 'cesta-basica-wa-v1'),
  ('Supermercado DIA Vila Madalena', 'Óleo de soja 900ml', 6.99, 'Supermercado - Promoção', -23.5532, -46.6915, true, now() + interval '14 days', CURRENT_DATE + 14, now(), 'demo_seed:cesta_basica_wa:v1', 'cesta-basica-wa-v1'),
  ('Supermercado DIA Vila Madalena', 'Leite integral 1L', 4.89, 'Supermercado - Promoção', -23.5532, -46.6915, true, now() + interval '14 days', CURRENT_DATE + 14, now(), 'demo_seed:cesta_basica_wa:v1', 'cesta-basica-wa-v1'),
  ('Assaí Atacadista', 'Arroz tipo 1 5kg', 19.90, 'Supermercado - Promoção', -23.5458, -46.6521, true, now() + interval '14 days', CURRENT_DATE + 14, now(), 'demo_seed:cesta_basica_wa:v1', 'cesta-basica-wa-v1'),
  ('Assaí Atacadista', 'Feijão carioca 1kg', 6.29, 'Supermercado - Promoção', -23.5458, -46.6521, true, now() + interval '14 days', CURRENT_DATE + 14, now(), 'demo_seed:cesta_basica_wa:v1', 'cesta-basica-wa-v1'),
  ('Assaí Atacadista', 'Batata frita palito 400g', 11.49, 'Supermercado - Promoção', -23.5458, -46.6521, true, now() + interval '14 days', CURRENT_DATE + 14, now(), 'demo_seed:cesta_basica_wa:v1', 'cesta-basica-wa-v1'),
  ('Assaí Atacadista', 'Óleo de soja 900ml', 5.89, 'Supermercado - Promoção', -23.5458, -46.6521, true, now() + interval '14 days', CURRENT_DATE + 14, now(), 'demo_seed:cesta_basica_wa:v1', 'cesta-basica-wa-v1'),
  ('Assaí Atacadista', 'Leite integral 1L', 4.29, 'Supermercado - Promoção', -23.5458, -46.6521, true, now() + interval '14 days', CURRENT_DATE + 14, now(), 'demo_seed:cesta_basica_wa:v1', 'cesta-basica-wa-v1'),
  ('Carrefour Express Pinheiros', 'Arroz tipo 1 5kg', 24.50, 'Supermercado - Promoção', -23.5614, -46.6822, true, now() + interval '14 days', CURRENT_DATE + 14, now(), 'demo_seed:cesta_basica_wa:v1', 'cesta-basica-wa-v1'),
  ('Carrefour Express Pinheiros', 'Feijão carioca 1kg', 7.99, 'Supermercado - Promoção', -23.5614, -46.6822, true, now() + interval '14 days', CURRENT_DATE + 14, now(), 'demo_seed:cesta_basica_wa:v1', 'cesta-basica-wa-v1'),
  ('Carrefour Express Pinheiros', 'Batata frita palito 400g', 13.50, 'Supermercado - Promoção', -23.5614, -46.6822, true, now() + interval '14 days', CURRENT_DATE + 14, now(), 'demo_seed:cesta_basica_wa:v1', 'cesta-basica-wa-v1'),
  ('Carrefour Express Pinheiros', 'Óleo de soja 900ml', 7.29, 'Supermercado - Promoção', -23.5614, -46.6822, true, now() + interval '14 days', CURRENT_DATE + 14, now(), 'demo_seed:cesta_basica_wa:v1', 'cesta-basica-wa-v1'),
  ('Carrefour Express Pinheiros', 'Leite integral 1L', 5.19, 'Supermercado - Promoção', -23.5614, -46.6822, true, now() + interval '14 days', CURRENT_DATE + 14, now(), 'demo_seed:cesta_basica_wa:v1', 'cesta-basica-wa-v1'),
  ('Pão de Açúcar Vila Madalena', 'Arroz tipo 1 5kg', 26.90, 'Supermercado - Promoção', -23.5491, -46.6934, true, now() + interval '14 days', CURRENT_DATE + 14, now(), 'demo_seed:cesta_basica_wa:v1', 'cesta-basica-wa-v1'),
  ('Pão de Açúcar Vila Madalena', 'Feijão carioca 1kg', 8.49, 'Supermercado - Promoção', -23.5491, -46.6934, true, now() + interval '14 days', CURRENT_DATE + 14, now(), 'demo_seed:cesta_basica_wa:v1', 'cesta-basica-wa-v1'),
  ('Pão de Açúcar Vila Madalena', 'Batata frita palito 400g', 14.90, 'Supermercado - Promoção', -23.5491, -46.6934, true, now() + interval '14 days', CURRENT_DATE + 14, now(), 'demo_seed:cesta_basica_wa:v1', 'cesta-basica-wa-v1'),
  ('Pão de Açúcar Vila Madalena', 'Óleo de soja 900ml', 7.99, 'Supermercado - Promoção', -23.5491, -46.6934, true, now() + interval '14 days', CURRENT_DATE + 14, now(), 'demo_seed:cesta_basica_wa:v1', 'cesta-basica-wa-v1'),
  ('Pão de Açúcar Vila Madalena', 'Leite integral 1L', 5.49, 'Supermercado - Promoção', -23.5491, -46.6934, true, now() + interval '14 days', CURRENT_DATE + 14, now(), 'demo_seed:cesta_basica_wa:v1', 'cesta-basica-wa-v1');
