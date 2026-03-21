-- Restaura / garante a tabela public.produtos (itens por transação).
-- Idempotente: pode rodar várias vezes no SQL Editor do Supabase.
--
-- Observação: o mapa lista price_points com TTL de 24h (pages/api/map/points.js).
-- Esta tabela guarda os produtos da nota; não controla o tempo no mapa.

CREATE TABLE IF NOT EXISTS public.produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transacao_id UUID NOT NULL REFERENCES public.transacoes(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  quantidade NUMERIC(10,3) DEFAULT 1,
  valor_unitario NUMERIC(12,2),
  valor_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Coluna usada por pages/api/ocr/save-transaction.js (unidade)
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS unidade TEXT;

CREATE INDEX IF NOT EXISTS idx_produtos_transacao_id ON public.produtos(transacao_id);

ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

-- Remove políticas conhecidas (nomes antigos e atuais) antes de recriar
DROP POLICY IF EXISTS "Users can view own products" ON public.produtos;
DROP POLICY IF EXISTS "Users can insert own products" ON public.produtos;
DROP POLICY IF EXISTS "Users can delete own products" ON public.produtos;
DROP POLICY IF EXISTS "Users can update own products" ON public.produtos;
DROP POLICY IF EXISTS "Permitir leitura de produtos" ON public.produtos;
DROP POLICY IF EXISTS "Usuários podem ler produtos de suas transações" ON public.produtos;
DROP POLICY IF EXISTS "Permitir inserção de produtos" ON public.produtos;
DROP POLICY IF EXISTS "Permitir atualização de produtos" ON public.produtos;
DROP POLICY IF EXISTS "Frontend pode ler produtos" ON public.produtos;
DROP POLICY IF EXISTS "API pode inserir produtos" ON public.produtos;
DROP POLICY IF EXISTS "API pode atualizar produtos" ON public.produtos;
DROP POLICY IF EXISTS "Service role pode inserir produtos" ON public.produtos;
DROP POLICY IF EXISTS "Service role pode atualizar produtos" ON public.produtos;

CREATE POLICY "Users can view own products" ON public.produtos FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.transacoes t WHERE t.id = transacao_id AND t.user_id = auth.uid()));

CREATE POLICY "Users can insert own products" ON public.produtos FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.transacoes t WHERE t.id = transacao_id AND t.user_id = auth.uid()));

CREATE POLICY "Users can update own products" ON public.produtos FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.transacoes t WHERE t.id = transacao_id AND t.user_id = auth.uid()));

CREATE POLICY "Users can delete own products" ON public.produtos FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.transacoes t WHERE t.id = transacao_id AND t.user_id = auth.uid()));

COMMENT ON TABLE public.produtos IS 'Itens de compra por transação (nota). O mapa comunitário usa price_points.';
