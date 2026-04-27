-- Fluxo "O que precisa comprar hoje?" → lista com match ao catálogo (imagem) → guardar / mapa / radar.
-- Estende shopping_list_items (linhas atuais da lista) sem duplicar tabela; shopping_lists continua snapshots do carrinho.

-- Produto canónico do repositório (public.products + product_images / cache no app).
ALTER TABLE public.shopping_list_items
  ADD COLUMN IF NOT EXISTS catalog_product_id UUID NULL
  REFERENCES public.products (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_shopping_list_items_catalog_product_id
  ON public.shopping_list_items (catalog_product_id)
  WHERE catalog_product_id IS NOT NULL;

COMMENT ON COLUMN public.shopping_list_items.catalog_product_id IS
  'Match ao catálogo após o utilizador digitar o nome (ex.: manga); usado para miniatura e dedupe.';

-- Miniatura já resolvida (URL pública do Storage ou cache do mapa); opcional — o cliente pode só usar catalog_product_id.
ALTER TABLE public.shopping_list_items
  ADD COLUMN IF NOT EXISTS list_thumbnail_url TEXT NULL;

COMMENT ON COLUMN public.shopping_list_items.list_thumbnail_url IS
  'URL da imagem mostrada na lista; preenchida pelo app quando houver match (catálogo ou map_product_image_cache).';

-- Intenção após o card inicial: montar plano, só lista para depois (radar / notificações futuras), ou sessão ativa no mapa.
ALTER TABLE public.shopping_list_items
  ADD COLUMN IF NOT EXISTS shopping_intent TEXT NULL
  CHECK (
    shopping_intent IS NULL
    OR shopping_intent IN ('plan_today', 'saved_deferred', 'map_active')
  );

COMMENT ON COLUMN public.shopping_list_items.shopping_intent IS
  'NULL = legado. plan_today = a montar a partir de "o que comprar hoje"; saved_deferred = guardou para comprar depois (candidato a radar); map_active = foi ver ofertas/rota no mapa nesta sessão.';

CREATE INDEX IF NOT EXISTS idx_shopping_list_items_owner_intent_pending
  ON public.shopping_list_items (owner_user_id, updated_at DESC)
  WHERE shopping_intent = 'saved_deferred'
    AND checked = false
    AND partnership_id IS NULL;

-- Preferências por utilizador para o "radar" (raio, ligado/desligado). Uma linha por dono.
CREATE TABLE IF NOT EXISTS public.shopping_radar_preferences (
  owner_user_id UUID PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT false,
  radius_m INTEGER NOT NULL DEFAULT 500
    CHECK (radius_m >= 100 AND radius_m <= 5000),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.shopping_radar_preferences IS
  'Geofence leve: utilizador opta por avisos ao aproximar-se de lojas com itens da lista (saved_deferred). Push/webhook fica no app.';

CREATE INDEX IF NOT EXISTS idx_shopping_radar_preferences_enabled
  ON public.shopping_radar_preferences (enabled)
  WHERE enabled = true;

ALTER TABLE public.shopping_radar_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shopping_radar_preferences_select" ON public.shopping_radar_preferences;
DROP POLICY IF EXISTS "shopping_radar_preferences_insert" ON public.shopping_radar_preferences;
DROP POLICY IF EXISTS "shopping_radar_preferences_update" ON public.shopping_radar_preferences;
DROP POLICY IF EXISTS "shopping_radar_preferences_delete" ON public.shopping_radar_preferences;

-- Mesmo padrão permissivo das listas em ambientes com sessão cliente (ajustar RLS depois se endurecer auth).
CREATE POLICY "shopping_radar_preferences_select"
  ON public.shopping_radar_preferences FOR SELECT USING (true);
CREATE POLICY "shopping_radar_preferences_insert"
  ON public.shopping_radar_preferences FOR INSERT WITH CHECK (true);
CREATE POLICY "shopping_radar_preferences_update"
  ON public.shopping_radar_preferences FOR UPDATE USING (true);
CREATE POLICY "shopping_radar_preferences_delete"
  ON public.shopping_radar_preferences FOR DELETE USING (true);
