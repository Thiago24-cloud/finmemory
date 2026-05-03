-- =============================================================================
-- FinMemory — Limpeza de public.promocoes_supermercados (encartes / agente)
-- Rode no SQL Editor do Supabase (preferência: janela com timeout alto ou
-- repetir o bloco DELETE em lotes até afetar 0 linhas).
--
-- Diagnóstico típico: a tabela cresce porque acumula linhas já vencidas
-- (expira_em < agora) ou inativas (ativo = false) com texto longo (imagem_url).
-- O app filtra ativo = true e expira_em > now(); o resto pode ser apagado.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0) Diagnóstico rápido (tamanho + contagens)
-- ---------------------------------------------------------------------------
SELECT
  pg_size_pretty(pg_total_relation_size('public.promocoes_supermercados')) AS tabela_total,
  pg_size_pretty(pg_relation_size('public.promocoes_supermercados')) AS heap_apenas;

SELECT count(*)::bigint AS total_linhas
FROM public.promocoes_supermercados;

SELECT count(*)::bigint AS vencidas_expira_em
FROM public.promocoes_supermercados
WHERE expira_em < now();

SELECT count(*)::bigint AS inativas
FROM public.promocoes_supermercados
WHERE ativo IS DISTINCT FROM true;

-- ---------------------------------------------------------------------------
-- 1) Limpeza principal — apaga promoções já vencidas (expira_em no passado)
--    Ajuste o LIMIT se o editor der timeout (ex.: 10_000 ou 50_000).
--    Repita o DELETE até "DELETE 0" (nenhuma linha removida).
-- ---------------------------------------------------------------------------
DELETE FROM public.promocoes_supermercados
WHERE id IN (
  SELECT ps.id
  FROM public.promocoes_supermercados AS ps
  WHERE ps.expira_em < now()
  LIMIT 50000
);

-- ---------------------------------------------------------------------------
-- 2) Opcional — inativas há muito tempo (substituição por run_id deixa
--    ativo = false mas expira_em pode ainda estar no futuro em alguns fluxos).
--    Descomente só se quiser cortar histórico antigo além do passo 1.
-- ---------------------------------------------------------------------------
-- DELETE FROM public.promocoes_supermercados
-- WHERE id IN (
--   SELECT ps.id
--   FROM public.promocoes_supermercados AS ps
--   WHERE ps.ativo IS DISTINCT FROM true
--     AND ps.atualizado_em < now() - interval '90 days'
--   LIMIT 50000
-- );

-- ---------------------------------------------------------------------------
-- 3) Após esvaziar lotes — devolver espaço ao SO e atualizar estatísticas
--    (no Supabase, rode esta linha sozinha depois dos DELETEs; não use
--     dentro da mesma transação que um DELETE gigante.)
-- ---------------------------------------------------------------------------
VACUUM ANALYZE public.promocoes_supermercados;

-- Verificação final
SELECT
  pg_size_pretty(pg_total_relation_size('public.promocoes_supermercados')) AS tabela_total_apos,
  (SELECT count(*) FROM public.promocoes_supermercados) AS linhas_restantes;
