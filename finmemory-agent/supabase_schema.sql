-- FinMemory: tabela de promoções coletadas pelo agente
-- Rode no SQL Editor do Supabase (schema public)
--
-- Migração a partir do schema ANTIGO (product_name, store_key, etc.):
--   1) Faça backup se tiver dados importantes.
--   2) Rode ANTES do restante:
--        DROP TABLE IF EXISTS public.promocoes_supermercados;
--   3) Execute este arquivo inteiro.
--
-- RLS: o service role do agente / API Next ignora RLS.
--      O app com usuário logado usa a policy "authenticated".
--      Se o mapa ("Waze dos Preços") ler com chave anon no cliente, mantenha a policy "anon" abaixo.

-- DROP TABLE IF EXISTS public.promocoes_supermercados;

CREATE TABLE IF NOT EXISTS public.promocoes_supermercados (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  supermercado    text        NOT NULL,
  nome_produto    text        NOT NULL,
  preco           numeric(10,2),
  preco_original  text,
  imagem_url      text,
  validade        date,
  lat             decimal(10,7),
  lng             decimal(10,7),
  run_id          text        NOT NULL,
  atualizado_em   timestamptz NOT NULL DEFAULT now(),
  expira_em       timestamptz NOT NULL,
  ativo           boolean     DEFAULT true,
  ingest_source   text,
  categoria       text,

  UNIQUE (supermercado, nome_produto, run_id)
);

CREATE INDEX IF NOT EXISTS idx_promo_supermercado ON public.promocoes_supermercados(supermercado);
CREATE INDEX IF NOT EXISTS idx_promo_ativo        ON public.promocoes_supermercados(ativo);
CREATE INDEX IF NOT EXISTS idx_promo_expira       ON public.promocoes_supermercados(expira_em DESC);
CREATE INDEX IF NOT EXISTS idx_promo_run_id       ON public.promocoes_supermercados(run_id);

ALTER TABLE public.promocoes_supermercados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários autenticados podem ler promoções" ON public.promocoes_supermercados;
CREATE POLICY "Usuários autenticados podem ler promoções"
  ON public.promocoes_supermercados FOR SELECT
  TO authenticated
  USING (true);

-- Mapa com Supabase client anon no browser (sem login): descomente ou rode estas linhas.
DROP POLICY IF EXISTS "Anon pode ler promoções" ON public.promocoes_supermercados;
CREATE POLICY "Anon pode ler promoções"
  ON public.promocoes_supermercados FOR SELECT
  TO anon
  USING (true);

-- Query que o app usa para buscar promoções ativas:
-- SELECT *
-- FROM public.promocoes_supermercados
-- WHERE ativo = true
--   AND expira_em > now()
-- ORDER BY atualizado_em DESC;
