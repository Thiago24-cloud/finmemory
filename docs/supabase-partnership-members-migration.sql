-- Parcerias com membros ilimitados: tabela partnership_members
-- Execute no Supabase: SQL Editor > New query > Cole e rode

-- 1) Criar tabela de membros (N pessoas por parceria)
CREATE TABLE IF NOT EXISTS public.partnership_members (
  partnership_id UUID NOT NULL REFERENCES public.partnerships(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (partnership_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_partnership_members_user_id ON public.partnership_members(user_id);
CREATE INDEX IF NOT EXISTS idx_partnership_members_partnership_id ON public.partnership_members(partnership_id);

ALTER TABLE public.partnership_members ENABLE ROW LEVEL SECURITY;

-- Políticas permissivas (compatível com app; ajuste se usar Supabase Auth)
DROP POLICY IF EXISTS "partnership_members_select" ON public.partnership_members;
DROP POLICY IF EXISTS "partnership_members_insert" ON public.partnership_members;
CREATE POLICY "partnership_members_select" ON public.partnership_members FOR SELECT USING (true);
CREATE POLICY "partnership_members_insert" ON public.partnership_members FOR INSERT WITH CHECK (true);

-- 2) Migrar dados existentes: user_id_1 e user_id_2 viram linhas em partnership_members
INSERT INTO public.partnership_members (partnership_id, user_id)
  SELECT id, user_id_1 FROM public.partnerships
  ON CONFLICT (partnership_id, user_id) DO NOTHING;

INSERT INTO public.partnership_members (partnership_id, user_id)
  SELECT id, user_id_2 FROM public.partnerships WHERE user_id_2 IS NOT NULL
  ON CONFLICT (partnership_id, user_id) DO NOTHING;
