-- Eventos de produto (mapa, NFC-e, login, etc.) para dashboard interno.
-- O app usa NextAuth + public.users.id (session.user.supabaseId), não auth.uid() no cliente.
-- Inserção: POST /api/analytics/event com sessão (service role no servidor).
-- Leitura agregada: SQL no Supabase ou rota admin com SUPABASE_SERVICE_ROLE_KEY.

CREATE TABLE IF NOT EXISTS public.user_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  page TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT user_events_event_name_len CHECK (char_length(event_name) <= 128),
  CONSTRAINT user_events_page_len CHECK (page IS NULL OR char_length(page) <= 512)
);

CREATE INDEX IF NOT EXISTS idx_user_events_created_at ON public.user_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_events_user_created ON public.user_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_events_event_name ON public.user_events (event_name);
CREATE INDEX IF NOT EXISTS idx_user_events_page ON public.user_events (page) WHERE page IS NOT NULL;

ALTER TABLE public.user_events ENABLE ROW LEVEL SECURITY;

-- Sem policies para anon/authenticated: inserções só via service role (API Next.js).
-- Service role ignora RLS e vê tudo — adequado para queries do dashboard interno.

COMMENT ON TABLE public.user_events IS
  'Telemetria por utilizador: event_name (ex. abriu_mapa), page opcional, created_at. Popular via API.';

-- Exemplos (SQL Editor, role postgres / service):
--
-- Utilizadores distintos por semana (qualquer evento)
--   SELECT date_trunc('week', created_at AT TIME ZONE 'America/Sao_Paulo') AS semana_sp,
--          COUNT(DISTINCT user_id) AS usuarios
--   FROM public.user_events
--   GROUP BY 1 ORDER BY 1 DESC;
--
-- Páginas mais vistas
--   SELECT COALESCE(page, '(sem page)') AS page, COUNT(*) AS n
--   FROM public.user_events
--   GROUP BY 1 ORDER BY n DESC LIMIT 30;
--
-- Pico por hora (America/Sao_Paulo)
--   SELECT EXTRACT(HOUR FROM (created_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')::int AS hora_sp,
--          COUNT(*) AS n
--   FROM public.user_events
--   GROUP BY 1 ORDER BY 1;
