-- ADM FinMemory Compra — MVP operacional (usuários WhatsApp, listas, preços manuais)

CREATE TABLE IF NOT EXISTS public.adm_compra_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  telefone text NOT NULL,
  cidade text,
  bairro text,
  perfil text NOT NULL DEFAULT 'Ambulante',
  produto_principal text,
  plano text NOT NULL DEFAULT 'Teste grátis',
  dia_compra text,
  status text NOT NULL DEFAULT 'Ativo',
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_adm_compra_users_cidade ON public.adm_compra_users (cidade);
CREATE INDEX IF NOT EXISTS idx_adm_compra_users_bairro ON public.adm_compra_users (bairro);
CREATE INDEX IF NOT EXISTS idx_adm_compra_users_perfil ON public.adm_compra_users (perfil);
CREATE INDEX IF NOT EXISTS idx_adm_compra_users_dia ON public.adm_compra_users (dia_compra);
CREATE INDEX IF NOT EXISTS idx_adm_compra_users_status ON public.adm_compra_users (status);
CREATE INDEX IF NOT EXISTS idx_adm_compra_users_plano ON public.adm_compra_users (plano);

CREATE TABLE IF NOT EXISTS public.adm_compra_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  categoria text,
  unidade text DEFAULT 'un.',
  marca text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_adm_compra_products_nome ON public.adm_compra_products (nome);
CREATE INDEX IF NOT EXISTS idx_adm_compra_products_ativo ON public.adm_compra_products (ativo);

CREATE TABLE IF NOT EXISTS public.adm_compra_markets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cidade text,
  bairro text,
  endereco text,
  contato text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_adm_compra_markets_bairro ON public.adm_compra_markets (bairro);

CREATE TABLE IF NOT EXISTS public.adm_compra_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.adm_compra_products(id) ON DELETE CASCADE,
  market_id uuid NOT NULL REFERENCES public.adm_compra_markets(id) ON DELETE CASCADE,
  preco numeric(12,2) NOT NULL CHECK (preco >= 0),
  data_preco date NOT NULL DEFAULT CURRENT_DATE,
  observacao text,
  fonte text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_adm_compra_prices_product ON public.adm_compra_prices (product_id);
CREATE INDEX IF NOT EXISTS idx_adm_compra_prices_market ON public.adm_compra_prices (market_id);
CREATE INDEX IF NOT EXISTS idx_adm_compra_prices_data ON public.adm_compra_prices (data_preco DESC);

CREATE TABLE IF NOT EXISTS public.adm_compra_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.adm_compra_users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.adm_compra_products(id) ON DELETE CASCADE,
  quantidade_media text,
  frequencia text DEFAULT 'Semanal',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_adm_compra_list_user ON public.adm_compra_list_items (user_id);

CREATE TABLE IF NOT EXISTS public.adm_compra_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.adm_compra_users(id) ON DELETE CASCADE,
  mensagem text NOT NULL,
  economia_estimada numeric(12,2),
  enviado boolean NOT NULL DEFAULT false,
  enviado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_adm_compra_alerts_user ON public.adm_compra_alerts (user_id);
CREATE INDEX IF NOT EXISTS idx_adm_compra_alerts_enviado ON public.adm_compra_alerts (enviado);

ALTER TABLE public.adm_compra_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adm_compra_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adm_compra_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adm_compra_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adm_compra_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adm_compra_alerts ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.adm_compra_users IS 'ADM FinMemory Compra — leads/clientes WhatsApp (MVP manual)';
COMMENT ON TABLE public.adm_compra_prices IS 'ADM FinMemory Compra — preços cadastrados manualmente';
