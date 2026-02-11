
-- Tabela de parcerias entre usuários
CREATE TABLE public.partnerships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id_1 UUID NOT NULL,
  user_id_2 UUID,
  invite_code TEXT NOT NULL UNIQUE DEFAULT substr(md5(random()::text), 1, 8),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.partnerships ENABLE ROW LEVEL SECURITY;

-- Security definer function to check if two users are partners
CREATE OR REPLACE FUNCTION public.is_partner(_user_id_a UUID, _user_id_b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.partnerships
    WHERE status = 'active'
      AND (
        (user_id_1 = _user_id_a AND user_id_2 = _user_id_b)
        OR (user_id_1 = _user_id_b AND user_id_2 = _user_id_a)
      )
  )
$$;

-- Function to get partner user_id
CREATE OR REPLACE FUNCTION public.get_partner_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN user_id_1 = _user_id THEN user_id_2
    ELSE user_id_1
  END
  FROM public.partnerships
  WHERE status = 'active'
    AND (user_id_1 = _user_id OR user_id_2 = _user_id)
  LIMIT 1
$$;

-- RLS for partnerships
CREATE POLICY "Users can view own partnerships"
  ON public.partnerships FOR SELECT
  USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

CREATE POLICY "Users can create partnerships"
  ON public.partnerships FOR INSERT
  WITH CHECK (auth.uid() = user_id_1);

CREATE POLICY "Users can update own partnerships"
  ON public.partnerships FOR UPDATE
  USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

CREATE POLICY "Users can delete own partnerships"
  ON public.partnerships FOR DELETE
  USING (auth.uid() = user_id_1);

-- Update transacoes RLS to allow partner access
CREATE POLICY "Partners can view each others transactions"
  ON public.transacoes FOR SELECT
  USING (public.is_partner(auth.uid(), user_id));

-- Lista de compras compartilhada
CREATE TABLE public.shopping_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partnership_id UUID NOT NULL REFERENCES public.partnerships(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity NUMERIC DEFAULT 1,
  unit TEXT,
  added_by UUID NOT NULL,
  checked BOOLEAN NOT NULL DEFAULT false,
  checked_by UUID,
  checked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.shopping_list_items ENABLE ROW LEVEL SECURITY;

-- RLS for shopping list - users can access items from their partnerships
CREATE POLICY "Users can view own partnership shopping items"
  ON public.shopping_list_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.partnerships p
      WHERE p.id = shopping_list_items.partnership_id
        AND p.status = 'active'
        AND (p.user_id_1 = auth.uid() OR p.user_id_2 = auth.uid())
    )
  );

CREATE POLICY "Users can insert into own partnership shopping list"
  ON public.shopping_list_items FOR INSERT
  WITH CHECK (
    auth.uid() = added_by
    AND EXISTS (
      SELECT 1 FROM public.partnerships p
      WHERE p.id = shopping_list_items.partnership_id
        AND p.status = 'active'
        AND (p.user_id_1 = auth.uid() OR p.user_id_2 = auth.uid())
    )
  );

CREATE POLICY "Users can update own partnership shopping items"
  ON public.shopping_list_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.partnerships p
      WHERE p.id = shopping_list_items.partnership_id
        AND p.status = 'active'
        AND (p.user_id_1 = auth.uid() OR p.user_id_2 = auth.uid())
    )
  );

CREATE POLICY "Users can delete own partnership shopping items"
  ON public.shopping_list_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.partnerships p
      WHERE p.id = shopping_list_items.partnership_id
        AND p.status = 'active'
        AND (p.user_id_1 = auth.uid() OR p.user_id_2 = auth.uid())
    )
  );

-- Enable realtime for shopping list
ALTER PUBLICATION supabase_realtime ADD TABLE public.shopping_list_items;

-- Triggers for updated_at
CREATE TRIGGER update_partnerships_updated_at
  BEFORE UPDATE ON public.partnerships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shopping_list_items_updated_at
  BEFORE UPDATE ON public.shopping_list_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
