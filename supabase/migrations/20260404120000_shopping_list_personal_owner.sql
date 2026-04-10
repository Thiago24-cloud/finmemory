-- Lista de compras e snapshots do mapa sem parceria: escopo por utilizador (owner_user_id).
-- Parceria ativa continua a usar partnership_id para partilha entre membros.

ALTER TABLE public.shopping_list_items
  ADD COLUMN IF NOT EXISTS owner_user_id UUID;

UPDATE public.shopping_list_items SET owner_user_id = added_by WHERE owner_user_id IS NULL;

ALTER TABLE public.shopping_list_items
  ALTER COLUMN owner_user_id SET NOT NULL;

ALTER TABLE public.shopping_list_items
  ALTER COLUMN partnership_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shopping_list_items_owner_personal
  ON public.shopping_list_items(owner_user_id, created_at DESC)
  WHERE partnership_id IS NULL;

COMMENT ON COLUMN public.shopping_list_items.owner_user_id IS 'Dono do item; partnership_id NULL = lista pessoal';

ALTER TABLE public.shopping_lists
  ADD COLUMN IF NOT EXISTS owner_user_id UUID;

UPDATE public.shopping_lists SET owner_user_id = created_by WHERE owner_user_id IS NULL;

ALTER TABLE public.shopping_lists
  ALTER COLUMN owner_user_id SET NOT NULL;

ALTER TABLE public.shopping_lists
  ALTER COLUMN partnership_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shopping_lists_owner_created
  ON public.shopping_lists(owner_user_id, created_at DESC)
  WHERE partnership_id IS NULL;

COMMENT ON COLUMN public.shopping_lists.owner_user_id IS 'Dono do snapshot; partnership_id NULL = lista salva só para este utilizador';
