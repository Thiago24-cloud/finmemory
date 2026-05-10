-- Perfil inicial: nome visível no app + foto opcional (Storage bucket avatars).

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS profile_first_login_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.users.avatar_url IS 'URL pública (Storage) da foto de perfil';
COMMENT ON COLUMN public.users.profile_first_login_completed_at IS 'Onboarding de primeiro login concluído (nome + foto opcional)';

-- Bucket público para avatares (upload via service role na API).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
