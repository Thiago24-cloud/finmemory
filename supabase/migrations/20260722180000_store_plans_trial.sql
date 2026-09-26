-- Planos B2B FinMemory store (lojista). Aditivo; sem DROP.
-- Não altera users.plano / Stripe Plus (app B2C).

CREATE TABLE IF NOT EXISTS public.store_plans (
  code text PRIMARY KEY,
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.store_plan_features (
  plan_code text NOT NULL REFERENCES public.store_plans(code) ON DELETE CASCADE,
  feature_key text NOT NULL,
  PRIMARY KEY (plan_code, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_store_plan_features_feature
  ON public.store_plan_features (feature_key);

CREATE TABLE IF NOT EXISTS public.store_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL UNIQUE REFERENCES public.stores(id) ON DELETE CASCADE,
  plan_code text NOT NULL REFERENCES public.store_plans(code),
  status text NOT NULL DEFAULT 'trialing'
    CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'expired')),
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_subscriptions_status
  ON public.store_subscriptions (status);

CREATE INDEX IF NOT EXISTS idx_store_subscriptions_trial_ends
  ON public.store_subscriptions (trial_ends_at)
  WHERE status = 'trialing';

COMMENT ON TABLE public.store_plans IS 'Catálogo de planos B2B (FinMemory store)';
COMMENT ON TABLE public.store_plan_features IS 'Features liberadas por plano B2B';
COMMENT ON TABLE public.store_subscriptions IS 'Assinatura/trial por loja (stores.id); sem pagamento online no MVP';

GRANT SELECT ON public.store_plans TO anon, authenticated, service_role;
GRANT SELECT ON public.store_plan_features TO anon, authenticated, service_role;
GRANT ALL ON public.store_subscriptions TO service_role;

ALTER TABLE public.store_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_plan_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_subscriptions ENABLE ROW LEVEL SECURITY;

-- Seed planos
INSERT INTO public.store_plans (code, name, description, sort_order) VALUES
  ('presenca_digital', 'Presença Digital', 'QR Code, página pública e cardápio digital', 1),
  ('pedidos_diretos', 'Pedidos Diretos', 'Pedidos, retirada e entrega local', 2),
  ('estoque_margem', 'Estoque e Margem', 'Estoque, NFC-e, margem e relatórios', 3),
  ('gestao_completa', 'Gestão Completa', 'Todas as funcionalidades do FinMemory store', 4)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  active = true;

-- Limpa features seed (idempotente por plano) e reinsere
DELETE FROM public.store_plan_features
WHERE plan_code IN ('presenca_digital', 'pedidos_diretos', 'estoque_margem', 'gestao_completa');

-- presenca_digital
INSERT INTO public.store_plan_features (plan_code, feature_key) VALUES
  ('presenca_digital', 'qr_code'),
  ('presenca_digital', 'public_store_page'),
  ('presenca_digital', 'digital_menu'),
  ('presenca_digital', 'customer_registration'),
  ('presenca_digital', 'price_map'),
  ('presenca_digital', 'manual_support');

-- pedidos_diretos = presença + pedidos
INSERT INTO public.store_plan_features (plan_code, feature_key) VALUES
  ('pedidos_diretos', 'qr_code'),
  ('pedidos_diretos', 'public_store_page'),
  ('pedidos_diretos', 'digital_menu'),
  ('pedidos_diretos', 'customer_registration'),
  ('pedidos_diretos', 'price_map'),
  ('pedidos_diretos', 'manual_support'),
  ('pedidos_diretos', 'direct_orders'),
  ('pedidos_diretos', 'pickup_orders'),
  ('pedidos_diretos', 'local_delivery'),
  ('pedidos_diretos', 'consumer_app_integration');

-- estoque_margem = pedidos + estoque
INSERT INTO public.store_plan_features (plan_code, feature_key) VALUES
  ('estoque_margem', 'qr_code'),
  ('estoque_margem', 'public_store_page'),
  ('estoque_margem', 'digital_menu'),
  ('estoque_margem', 'customer_registration'),
  ('estoque_margem', 'price_map'),
  ('estoque_margem', 'manual_support'),
  ('estoque_margem', 'direct_orders'),
  ('estoque_margem', 'pickup_orders'),
  ('estoque_margem', 'local_delivery'),
  ('estoque_margem', 'consumer_app_integration'),
  ('estoque_margem', 'inventory_control'),
  ('estoque_margem', 'receipt_import'),
  ('estoque_margem', 'margin_calculation'),
  ('estoque_margem', 'reports');

-- gestao_completa = tudo
INSERT INTO public.store_plan_features (plan_code, feature_key) VALUES
  ('gestao_completa', 'qr_code'),
  ('gestao_completa', 'public_store_page'),
  ('gestao_completa', 'digital_menu'),
  ('gestao_completa', 'customer_registration'),
  ('gestao_completa', 'price_map'),
  ('gestao_completa', 'manual_support'),
  ('gestao_completa', 'direct_orders'),
  ('gestao_completa', 'pickup_orders'),
  ('gestao_completa', 'local_delivery'),
  ('gestao_completa', 'consumer_app_integration'),
  ('gestao_completa', 'inventory_control'),
  ('gestao_completa', 'receipt_import'),
  ('gestao_completa', 'margin_calculation'),
  ('gestao_completa', 'reports'),
  ('gestao_completa', 'whatsapp_campaigns'),
  ('gestao_completa', 'consumer_financial_history');
