-- Pedidos pick-up por loja (multitenancy via loja_id) + ETA.

CREATE TABLE IF NOT EXISTS public.pedidos_loja (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.stores (id) ON DELETE CASCADE,
  cliente_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'preparando', 'pronto', 'concluido', 'cancelado')),
  total numeric(14, 2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  observacao text,
  tempo_preparo_minutos integer NOT NULL DEFAULT 15 CHECK (tempo_preparo_minutos > 0),
  eta_previsto_em timestamptz NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  preparo_iniciado_em timestamptz,
  pronto_em timestamptz,
  concluido_em timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pedidos_loja_loja_status_criado
  ON public.pedidos_loja (loja_id, status, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_pedidos_loja_cliente
  ON public.pedidos_loja (cliente_user_id, criado_em DESC);

COMMENT ON TABLE public.pedidos_loja IS
  'Pedidos de retirada no balcão (FinMemory Parceiros). Tenant = loja_id.';

CREATE TABLE IF NOT EXISTS public.pedidos_loja_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos_loja (id) ON DELETE CASCADE,
  produto_loja_id uuid REFERENCES public.produtos_loja (id) ON DELETE SET NULL,
  nome text NOT NULL,
  preco_unitario numeric(14, 2) NOT NULL CHECK (preco_unitario >= 0),
  quantidade integer NOT NULL DEFAULT 1 CHECK (quantidade > 0)
);

CREATE INDEX IF NOT EXISTS idx_pedidos_loja_itens_pedido
  ON public.pedidos_loja_itens (pedido_id);

-- ---------------------------------------------------------------------------
-- RLS (acesso direto Supabase; APIs usam service role)
-- ---------------------------------------------------------------------------
ALTER TABLE public.pedidos_loja ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos_loja_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pedidos_loja_select_tenant ON public.pedidos_loja;
CREATE POLICY pedidos_loja_select_tenant ON public.pedidos_loja
  FOR SELECT TO authenticated
  USING (loja_id = public.get_meu_loja_id());

DROP POLICY IF EXISTS pedidos_loja_update_tenant ON public.pedidos_loja;
CREATE POLICY pedidos_loja_update_tenant ON public.pedidos_loja
  FOR UPDATE TO authenticated
  USING (loja_id = public.get_meu_loja_id())
  WITH CHECK (loja_id = public.get_meu_loja_id());

DROP POLICY IF EXISTS pedidos_loja_select_cliente ON public.pedidos_loja;
CREATE POLICY pedidos_loja_select_cliente ON public.pedidos_loja
  FOR SELECT TO authenticated
  USING (cliente_user_id = auth.uid());

DROP POLICY IF EXISTS pedidos_loja_itens_select_via_pedido ON public.pedidos_loja_itens;
CREATE POLICY pedidos_loja_itens_select_via_pedido ON public.pedidos_loja_itens
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pedidos_loja p
      WHERE p.id = pedido_id
        AND (
          p.loja_id = public.get_meu_loja_id()
          OR p.cliente_user_id = auth.uid()
        )
    )
  );

GRANT SELECT, UPDATE ON public.pedidos_loja TO authenticated;
GRANT SELECT ON public.pedidos_loja_itens TO authenticated;
