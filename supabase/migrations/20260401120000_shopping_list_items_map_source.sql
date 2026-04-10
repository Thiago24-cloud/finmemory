-- Itens vindos do mapa (preço, loja) vs anotações manuais (comportamento original).
ALTER TABLE public.shopping_list_items
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'note'
    CHECK (source_type IN ('note', 'map'));

ALTER TABLE public.shopping_list_items
  ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12, 2) NULL;

ALTER TABLE public.shopping_list_items
  ADD COLUMN IF NOT EXISTS price_label TEXT NULL;

ALTER TABLE public.shopping_list_items
  ADD COLUMN IF NOT EXISTS store_label TEXT NULL;

ALTER TABLE public.shopping_list_items
  ADD COLUMN IF NOT EXISTS map_offer_id TEXT NULL;

ALTER TABLE public.shopping_list_items
  ADD COLUMN IF NOT EXISTS shopping_list_group_id UUID NULL
    REFERENCES public.shopping_lists(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_shopping_list_items_group
  ON public.shopping_list_items(partnership_id, shopping_list_group_id)
  WHERE shopping_list_group_id IS NOT NULL;

COMMENT ON COLUMN public.shopping_list_items.source_type IS 'note = digitado na lista; map = linha do carrinho do mapa';
COMMENT ON COLUMN public.shopping_list_items.shopping_list_group_id IS 'Mesmo id do snapshot em shopping_lists ao salvar o carrinho';
