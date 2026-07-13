-- Mesas do restaurante (FinMemory Parceiros) + origem do pedido.

CREATE TABLE IF NOT EXISTS public.mesas_loja (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.stores (id) ON DELETE CASCADE,
  numero integer NOT NULL CHECK (numero >= 0),
  capacidade integer NOT NULL DEFAULT 4 CHECK (capacidade > 0),
  status text NOT NULL DEFAULT 'livre'
    CHECK (status IN ('livre', 'ocupada', 'reservada', 'fechada')),
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (loja_id, numero)
);

CREATE INDEX IF NOT EXISTS idx_mesas_loja_loja_numero
  ON public.mesas_loja (loja_id, numero);

COMMENT ON TABLE public.mesas_loja IS
  'Mesas numeradas do restaurante (tenant = loja_id).';

ALTER TABLE public.mesas_loja ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mesas_loja_select_tenant ON public.mesas_loja;
CREATE POLICY mesas_loja_select_tenant ON public.mesas_loja
  FOR SELECT TO authenticated
  USING (loja_id = public.get_meu_loja_id());

DROP POLICY IF EXISTS mesas_loja_insert_tenant ON public.mesas_loja;
CREATE POLICY mesas_loja_insert_tenant ON public.mesas_loja
  FOR INSERT TO authenticated
  WITH CHECK (loja_id = public.get_meu_loja_id());

DROP POLICY IF EXISTS mesas_loja_update_tenant ON public.mesas_loja;
CREATE POLICY mesas_loja_update_tenant ON public.mesas_loja
  FOR UPDATE TO authenticated
  USING (loja_id = public.get_meu_loja_id())
  WITH CHECK (loja_id = public.get_meu_loja_id());

DROP POLICY IF EXISTS mesas_loja_delete_tenant ON public.mesas_loja;
CREATE POLICY mesas_loja_delete_tenant ON public.mesas_loja
  FOR DELETE TO authenticated
  USING (loja_id = public.get_meu_loja_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mesas_loja TO authenticated;

-- Pedidos: mesa e origem (balcão, mesa, delivery)
ALTER TABLE public.pedidos_loja
  ADD COLUMN IF NOT EXISTS mesa_id uuid REFERENCES public.mesas_loja (id) ON DELETE SET NULL;

ALTER TABLE public.pedidos_loja
  ADD COLUMN IF NOT EXISTS mesa_numero integer;

ALTER TABLE public.pedidos_loja
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'balcao'
    CHECK (origem IN ('balcao', 'mesa', 'delivery', 'garcom'));

CREATE INDEX IF NOT EXISTS idx_pedidos_loja_mesa
  ON public.pedidos_loja (loja_id, mesa_id)
  WHERE mesa_id IS NOT NULL;
