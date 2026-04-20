-- Planos Stripe (Plus / Pro / Família): users (NextAuth) + profiles (quando existir auth.users).
--
-- Alguns projetos Supabase não têm public.profiles (migrações iniciais não corridas).
-- Por isso criamos a tabela base aqui com IF NOT EXISTS antes do ALTER das colunas Stripe.

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  avatar_url TEXT,
  last_sync TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (só criar se ainda não existirem — migração idempotente em re-execuções manuais)
DO $rls$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Users can view own profile'
  ) THEN
    CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Users can insert own profile'
  ) THEN
    CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Users can update own profile'
  ) THEN
    CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END
$rls$;

COMMENT ON TABLE public.profiles IS 'Perfil ligado a auth.users; webhook Stripe pode espelhar plano por email igual a public.users.email';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plano TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS plano_ativo BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS plano_atualizado_em TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.plano IS 'free | plus | pro | familia (espelho Stripe)';
COMMENT ON COLUMN public.profiles.plano_ativo IS 'Assinatura ativa (Stripe active/trialing)';
COMMENT ON COLUMN public.profiles.stripe_customer_id IS 'Stripe Customer id (cus_...)';
COMMENT ON COLUMN public.profiles.stripe_subscription_id IS 'Stripe Subscription id (sub_...)';
COMMENT ON COLUMN public.profiles.plano_atualizado_em IS 'Última sincronização com Stripe';

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id
  ON public.profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- public.users (session NextAuth: session.user.supabaseId)
DO $users$
BEGIN
  IF to_regclass('public.users') IS NOT NULL THEN
    ALTER TABLE public.users
      ADD COLUMN IF NOT EXISTS plano TEXT NOT NULL DEFAULT 'free',
      ADD COLUMN IF NOT EXISTS plano_ativo BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS plano_atualizado_em TIMESTAMPTZ;
    COMMENT ON COLUMN public.users.plano IS 'free | plus | pro | familia';
    COMMENT ON COLUMN public.users.plano_ativo IS 'Assinatura ativa (Stripe active/trialing)';
    COMMENT ON COLUMN public.users.plano_atualizado_em IS 'Última sincronização com Stripe';
  END IF;
END
$users$;
