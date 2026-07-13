-- ADIADO: integrações delivery (iFood, 99Food, Keeta).
-- Rode esta migração somente quando for implementar webhooks/APIs dos apps.

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
