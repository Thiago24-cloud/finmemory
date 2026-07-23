-- Pedido direto (QR / página pública): guest, pickup code, order_type/source.
-- Aditivo; mantém status PT legados (mesa/cozinha) e acrescenta status EN.

-- Cliente opcional (pedido sem conta completa)
ALTER TABLE public.pedidos_loja
  ALTER COLUMN cliente_user_id DROP NOT NULL;

ALTER TABLE public.pedidos_loja
  ADD COLUMN IF NOT EXISTS customer_name text;

ALTER TABLE public.pedidos_loja
  ADD COLUMN IF NOT EXISTS customer_phone text;

ALTER TABLE public.pedidos_loja
  ADD COLUMN IF NOT EXISTS order_type text
    CHECK (order_type IS NULL OR order_type IN ('pickup', 'delivery'));

ALTER TABLE public.pedidos_loja
  ADD COLUMN IF NOT EXISTS pickup_code text;

ALTER TABLE public.pedidos_loja
  ADD COLUMN IF NOT EXISTS order_source text
    CHECK (order_source IS NULL OR order_source IN ('qr_code', 'public_page', 'manual'));

ALTER TABLE public.pedidos_loja
  ADD COLUMN IF NOT EXISTS restaurant_customer_id uuid;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'restaurant_customers'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pedidos_loja_restaurant_customer_id_fkey'
  ) THEN
    ALTER TABLE public.pedidos_loja
      ADD CONSTRAINT pedidos_loja_restaurant_customer_id_fkey
      FOREIGN KEY (restaurant_customer_id)
      REFERENCES public.restaurant_customers (id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pedidos_loja_pickup_code
  ON public.pedidos_loja (loja_id, pickup_code)
  WHERE pickup_code IS NOT NULL AND pickup_code <> '';

CREATE INDEX IF NOT EXISTS idx_pedidos_loja_order_source
  ON public.pedidos_loja (loja_id, order_source, criado_em DESC)
  WHERE order_source IS NOT NULL;

-- Status: PT legado + EN pedido direto
ALTER TABLE public.pedidos_loja
  DROP CONSTRAINT IF EXISTS pedidos_loja_status_check;

ALTER TABLE public.pedidos_loja
  ADD CONSTRAINT pedidos_loja_status_check
  CHECK (status IN (
    'pendente', 'preparando', 'pronto', 'concluido', 'cancelado',
    'pending', 'accepted', 'preparing', 'ready_for_pickup',
    'out_for_delivery', 'delivered', 'canceled'
  ));

-- origem operacional: manter + permitir qr_public para filtros
ALTER TABLE public.pedidos_loja
  DROP CONSTRAINT IF EXISTS pedidos_loja_origem_check;

ALTER TABLE public.pedidos_loja
  ADD CONSTRAINT pedidos_loja_origem_check
  CHECK (origem IN ('balcao', 'mesa', 'delivery', 'garcom', 'qr_public'));

COMMENT ON COLUMN public.pedidos_loja.customer_name IS
  'Nome do cliente no pedido direto (guest ou conta leve).';
COMMENT ON COLUMN public.pedidos_loja.customer_phone IS
  'WhatsApp/telefone do cliente (dígitos ou formatado).';
COMMENT ON COLUMN public.pedidos_loja.order_type IS
  'pickup | delivery (pedido direto).';
COMMENT ON COLUMN public.pedidos_loja.pickup_code IS
  'Código de retirada (ex.: FM-2481).';
COMMENT ON COLUMN public.pedidos_loja.order_source IS
  'qr_code | public_page | manual.';

-- Snapshot total da linha (opcional; API também calcula)
ALTER TABLE public.pedidos_loja_itens
  ADD COLUMN IF NOT EXISTS total_price numeric(14, 2);

COMMENT ON COLUMN public.pedidos_loja_itens.total_price IS
  'quantidade * preco_unitario no momento do pedido.';
