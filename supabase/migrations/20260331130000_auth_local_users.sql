CREATE TABLE IF NOT EXISTS public.auth_local_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_local_users_user_id ON public.auth_local_users(user_id);

ALTER TABLE public.auth_local_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own local auth row" ON public.auth_local_users;
CREATE POLICY "Users can read own local auth row"
  ON public.auth_local_users
  FOR SELECT
  USING (auth.uid() = user_id);

