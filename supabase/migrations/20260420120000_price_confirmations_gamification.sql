-- Gamificação: confirmações de preço na loja + XP em public.users (session NextAuth = users.id).
-- Opcional: colunas espelho em profiles (auth.users); o app grava XP via API em public.users.

DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL THEN
    ALTER TABLE public.users
      ADD COLUMN IF NOT EXISTS xp_points integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS contributions_count integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS level integer NOT NULL DEFAULT 1;
    COMMENT ON COLUMN public.users.xp_points IS 'XP por confirmações de preço no mapa (+10 por dia/oferta).';
    COMMENT ON COLUMN public.users.contributions_count IS 'Total de confirmações registradas (price_confirmations).';
    COMMENT ON COLUMN public.users.level IS 'Nível derivado do XP (ex.: 1 + floor(xp/100)).';
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS xp_points integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contributions_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS level integer NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS public.price_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.stores (id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('price_points', 'agent_promotion', 'encarte')),
  offer_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS price_confirmations_user_offer_sp_day_uq
  ON public.price_confirmations (
    app_user_id,
    establishment_id,
    source,
    offer_key,
    ((timezone('America/Sao_Paulo', created_at))::date)
  );

CREATE INDEX IF NOT EXISTS idx_price_confirmations_establishment_created
  ON public.price_confirmations (establishment_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_price_confirmations_user_created
  ON public.price_confirmations (app_user_id, created_at DESC);

COMMENT ON TABLE public.price_confirmations IS
  'Confirmação social de que o preço ainda vale na loja; no máximo 1 por usuário/oferta/dia (America/Sao_Paulo).';

ALTER TABLE public.price_confirmations ENABLE ROW LEVEL SECURITY;

-- Sem policies: leitura/escrita via service role (API Next.js). Cliente anon não acessa.

CREATE OR REPLACE VIEW public.weekly_finrank AS
SELECT
  ranked.id,
  ranked.full_name,
  ranked.avatar_url,
  ranked.xp_points,
  ranked.contributions_count,
  ranked.level,
  ranked.confirmations_this_week,
  ranked.rank_position
FROM (
  SELECT
    u.id,
    u.name AS full_name,
    NULL::text AS avatar_url,
    COALESCE(u.xp_points, 0) AS xp_points,
    COALESCE(u.contributions_count, 0) AS contributions_count,
    COALESCE(u.level, 1) AS level,
    COUNT(pc.id)::bigint AS confirmations_this_week,
    RANK() OVER (ORDER BY COUNT(pc.id) DESC NULLS LAST) AS rank_position
  FROM public.users u
  LEFT JOIN public.price_confirmations pc
    ON pc.app_user_id = u.id
    AND pc.created_at > (NOW() AT TIME ZONE 'UTC') - INTERVAL '7 days'
  GROUP BY u.id, u.name, u.xp_points, u.contributions_count, u.level
  ORDER BY confirmations_this_week DESC NULLS LAST
  LIMIT 50
) ranked;

COMMENT ON VIEW public.weekly_finrank IS 'Ranking semanal (confirmações nos últimos 7 dias); painel admin /api/admin/finrank.';
