-- Podes correr este ficheiro sozinho no SQL Editor: cria colunas/bucket se faltarem e só depois faz o UPDATE.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS profile_first_login_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.users.avatar_url IS 'URL pública (Storage) da foto de perfil';
COMMENT ON COLUMN public.users.profile_first_login_completed_at IS 'Onboarding de primeiro login concluído (nome + foto opcional)';

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

-- Quem ainda só tem nome “placeholder” (igual ao email ou à parte antes do @) precisa passar
-- pelo questionário pelo menos uma vez — zera o marcador para essas linhas.

UPDATE public.users
SET profile_first_login_completed_at = NULL
WHERE
  trim(coalesce(name, '')) = ''
  OR lower(trim(name)) = lower(trim(coalesce(email, '')))
  OR (
    position('@' in coalesce(email, '')) > 0
    AND lower(trim(name)) = lower(split_part(trim(email), '@', 1))
  )
  OR position('@' in trim(coalesce(name, ''))) > 0;
