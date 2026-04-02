-- Listas salvas a partir do carrinho do mapa (snapshot: itens, total, data).
CREATE TABLE IF NOT EXISTS public.shopping_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partnership_id UUID NOT NULL REFERENCES public.partnerships(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shopping_lists_partnership_created
  ON public.shopping_lists(partnership_id, created_at DESC);

ALTER TABLE public.shopping_lists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shopping_lists_select" ON public.shopping_lists;
DROP POLICY IF EXISTS "shopping_lists_insert" ON public.shopping_lists;
DROP POLICY IF EXISTS "shopping_lists_update" ON public.shopping_lists;
DROP POLICY IF EXISTS "shopping_lists_delete" ON public.shopping_lists;

-- Alinhado ao fluxo cliente com anon key (users / partnership_members), como shopping_list_items em ambientes permissivos.
CREATE POLICY "shopping_lists_select" ON public.shopping_lists FOR SELECT USING (true);
CREATE POLICY "shopping_lists_insert" ON public.shopping_lists FOR INSERT WITH CHECK (true);
