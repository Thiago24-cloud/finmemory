-- Migration: Criar tabela partnerships (Parceria) e shopping_list_items
-- Execute no Supabase: SQL Editor > New query > Cole e rode

-- Função updated_at (se ainda não existir)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Tabela de parcerias
CREATE TABLE IF NOT EXISTS public.partnerships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id_1 UUID NOT NULL,
  user_id_2 UUID,
  invite_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.partnerships ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem (evitar conflito)
DROP POLICY IF EXISTS "Users can view own partnerships" ON public.partnerships;
DROP POLICY IF EXISTS "Users can create partnerships" ON public.partnerships;
DROP POLICY IF EXISTS "Users can update own partnerships" ON public.partnerships;
DROP POLICY IF EXISTS "Users can delete own partnerships" ON public.partnerships;
DROP POLICY IF EXISTS "partnerships_select" ON public.partnerships;
DROP POLICY IF EXISTS "partnerships_insert" ON public.partnerships;
DROP POLICY IF EXISTS "partnerships_update" ON public.partnerships;
DROP POLICY IF EXISTS "partnerships_delete" ON public.partnerships;

-- Políticas permissivas (compatível com NextAuth; ajuste depois se usar Supabase Auth)
CREATE POLICY "partnerships_select" ON public.partnerships FOR SELECT USING (true);
CREATE POLICY "partnerships_insert" ON public.partnerships FOR INSERT WITH CHECK (true);
CREATE POLICY "partnerships_update" ON public.partnerships FOR UPDATE USING (true);
CREATE POLICY "partnerships_delete" ON public.partnerships FOR DELETE USING (true);

-- Tabela de itens da lista de compras
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

DROP POLICY IF EXISTS "Users can view own partnership shopping items" ON public.shopping_list_items;
DROP POLICY IF EXISTS "Users can insert into own partnership shopping list" ON public.shopping_list_items;
DROP POLICY IF EXISTS "Users can update own partnership shopping items" ON public.shopping_list_items;
DROP POLICY IF EXISTS "Users can delete own partnership shopping items" ON public.shopping_list_items;
DROP POLICY IF EXISTS "shopping_list_select" ON public.shopping_list_items;
DROP POLICY IF EXISTS "shopping_list_insert" ON public.shopping_list_items;
DROP POLICY IF EXISTS "shopping_list_update" ON public.shopping_list_items;
DROP POLICY IF EXISTS "shopping_list_delete" ON public.shopping_list_items;

CREATE POLICY "shopping_list_select" ON public.shopping_list_items FOR SELECT USING (true);
CREATE POLICY "shopping_list_insert" ON public.shopping_list_items FOR INSERT WITH CHECK (true);
CREATE POLICY "shopping_list_update" ON public.shopping_list_items FOR UPDATE USING (true);
CREATE POLICY "shopping_list_delete" ON public.shopping_list_items FOR DELETE USING (true);

-- Triggers
DROP TRIGGER IF EXISTS update_partnerships_updated_at ON public.partnerships;
CREATE TRIGGER update_partnerships_updated_at
  BEFORE UPDATE ON public.partnerships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_shopping_list_items_updated_at ON public.shopping_list_items;
CREATE TRIGGER update_shopping_list_items_updated_at
  BEFORE UPDATE ON public.shopping_list_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Índice para busca por código
CREATE INDEX IF NOT EXISTS idx_partnerships_invite_code ON public.partnerships(invite_code);
CREATE INDEX IF NOT EXISTS idx_shopping_list_partnership ON public.shopping_list_items(partnership_id);
