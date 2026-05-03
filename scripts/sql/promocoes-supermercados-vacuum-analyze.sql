-- =============================================================================
-- FinMemory — VACUUM ANALYZE só para public.promocoes_supermercados
-- =============================================================================
--
-- ⚠️  Rode APENAS este snippet, sozinho, num NOVO query no Supabase.
--     Não misture com SELECT/DELETE na mesma execução (erro 25001: VACUUM
--     não pode correr dentro de um bloco de transação).
--
--     Comando tem de estar em inglês (ex.: não use tradução automática).
-- =============================================================================

VACUUM ANALYZE public.promocoes_supermercados;
