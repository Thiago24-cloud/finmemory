-- ============================================
-- Migrações do Smart Receipt Scanner para FinMemory
-- Execute no Supabase SQL Editor (na ordem).
-- Se você usa apenas NextAuth (não Supabase Auth), as políticas com auth.uid()
-- não se aplicam; as APIs do Next usam service_role e validam userId da sessão.
-- ============================================

-- 1) Coluna image_url em price_points (opcional)
ALTER TABLE public.price_points
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2) Bucket para fotos de preços compartilhados (crie manualmente no Storage se precisar)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('price-photos', 'price-photos', true)
-- ON CONFLICT (id) DO NOTHING;

-- 3) Tabela partnerships
CREATE TABLE IF NOT EXISTS public.partnerships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id_1 UUID NOT NULL,
  user_id_2 UUID,
  invite_code TEXT NOT NULL UNIQUE DEFAULT upper(substr(md5(random()::text), 1, 8)),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.partnerships ENABLE ROW LEVEL SECURITY;

-- Políticas: permitir tudo para service_role; para anon/authenticated você pode restringir depois.
CREATE POLICY "partnerships_select" ON public.partnerships FOR SELECT USING (true);
CREATE POLICY "partnerships_insert" ON public.partnerships FOR INSERT WITH CHECK (true);
CREATE POLICY "partnerships_update" ON public.partnerships FOR UPDATE USING (true);
CREATE POLICY "partnerships_delete" ON public.partnerships FOR DELETE USING (true);

-- 4) Funções para parceria (referenciam user_id da tabela users/public)
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

-- 5) Tabela shopping_list_items
CREATE TABLE IF NOT EXISTS public.shopping_list_items (
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

CREATE POLICY "shopping_list_select" ON public.shopping_list_items FOR SELECT USING (true);
CREATE POLICY "shopping_list_insert" ON public.shopping_list_items FOR INSERT WITH CHECK (true);
CREATE POLICY "shopping_list_update" ON public.shopping_list_items FOR UPDATE USING (true);
CREATE POLICY "shopping_list_delete" ON public.shopping_list_items FOR DELETE USING (true);

-- 6) Trigger updated_at (reutilizar se já existir update_updated_at_column)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_partnerships_updated_at ON public.partnerships;
CREATE TRIGGER update_partnerships_updated_at
  BEFORE UPDATE ON public.partnerships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_shopping_list_items_updated_at ON public.shopping_list_items;
CREATE TRIGGER update_shopping_list_items_updated_at
  BEFORE UPDATE ON public.shopping_list_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Fim das migrações
