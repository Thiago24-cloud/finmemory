-- Restaurante operacional: composições (preparo), entrega e integrações.

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS delivery_manual_ativo boolean NOT NULL DEFAULT false;

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS delivery_taxa numeric(10, 2) NOT NULL DEFAULT 0 CHECK (delivery_taxa >= 0);

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS delivery_tempo_minutos integer NOT NULL DEFAULT 45 CHECK (delivery_tempo_minutos > 0);

COMMENT ON COLUMN public.stores.delivery_manual_ativo IS
  'Entrega manual ativa (pedidos origem=delivery).';

-- Composição cardápio → insumos (planejamento de preparo)
CREATE TABLE IF NOT EXISTS public.produto_composicao_loja (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.stores (id) ON DELETE CASCADE,
  produto_loja_id uuid NOT NULL REFERENCES public.produtos_loja (id) ON DELETE CASCADE,
  insumo_id uuid NOT NULL REFERENCES public.insumos_loja (id) ON DELETE CASCADE,
  quantidade_porcao numeric(12, 3) NOT NULL DEFAULT 1 CHECK (quantidade_porcao > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (produto_loja_id, insumo_id)
);

CREATE INDEX IF NOT EXISTS idx_produto_composicao_loja_produto
  ON public.produto_composicao_loja (produto_loja_id);

ALTER TABLE public.produto_composicao_loja ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS produto_composicao_select_tenant ON public.produto_composicao_loja;
CREATE POLICY produto_composicao_select_tenant ON public.produto_composicao_loja
  FOR SELECT TO authenticated
  USING (loja_id = public.get_meu_loja_id());

DROP POLICY IF EXISTS produto_composicao_write_tenant ON public.produto_composicao_loja;
CREATE POLICY produto_composicao_write_tenant ON public.produto_composicao_loja
  FOR ALL TO authenticated
  USING (loja_id = public.get_meu_loja_id())
  WITH CHECK (loja_id = public.get_meu_loja_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.produto_composicao_loja TO authenticated;

-- Integrações delivery (iFood, 99, etc.)
CREATE TABLE IF NOT EXISTS public.entregas_integracao_loja (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.stores (id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'other'
    CHECK (provider IN ('ifood', '99food', 'keeta', 'manual', 'other')),
  nome text NOT NULL,
  merchant_id text,
  client_id text,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (loja_id, provider)
);

ALTER TABLE public.entregas_integracao_loja ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS entregas_integracao_select_tenant ON public.entregas_integracao_loja;
CREATE POLICY entregas_integracao_select_tenant ON public.entregas_integracao_loja
  FOR SELECT TO authenticated
  USING (loja_id = public.get_meu_loja_id());

DROP POLICY IF EXISTS entregas_integracao_write_tenant ON public.entregas_integracao_loja;
CREATE POLICY entregas_integracao_write_tenant ON public.entregas_integracao_loja
  FOR ALL TO authenticated
  USING (loja_id = public.get_meu_loja_id())
  WITH CHECK (loja_id = public.get_meu_loja_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.entregas_integracao_loja TO authenticated;
