-- =============================================================================
-- FinMemory — Limpeza de public.promocoes_supermercados (encartes / agente)
-- =============================================================================
--
-- ⚠️  SUPABASE SQL EDITOR — VACUUM
--     O PostgreSQL NÃO permite VACUUM dentro de uma transação (erro 25001).
--     O editor, ao executar várias instruções de seguida, pode meter tudo no
--     mesmo bloco transacional. Por isso este ficheiro NÃO inclui VACUUM.
--
--     Depois dos DELETEs, abra um NOVO query / novo snippet e execute SÓ o
--     ficheiro:  promocoes-supermercados-vacuum-analyze.sql
--     (uma linha: VACUUM ANALYZE …)
--
--     Use sempre o comando em inglês: VACUUM ANALYZE — não traduza o SQL.
--
-- =============================================================================
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
--    Ajuste o LIMIT se o editor der timeout (ex.: 10000 ou 50000).
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
-- 3) Verificação final (pode correr no mesmo snippet que os DELETEs)
--    Para libertar espaço no disco / estatísticas: ficheiro separado VACUUM.
-- ---------------------------------------------------------------------------
SELECT
  pg_size_pretty(pg_total_relation_size('public.promocoes_supermercados')) AS tabela_total_apos,
  (SELECT count(*) FROM public.promocoes_supermercados) AS linhas_restantes;
