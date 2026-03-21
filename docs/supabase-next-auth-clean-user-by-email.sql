-- =============================================================================
-- Remove usuário do next_auth para permitir login limpo (resolve OAuthAccountNotLinked)
-- Use quando: usuário existe em next_auth.users mas a conta Google não está em
-- next_auth.accounts (ex.: falhou linkAccount por coluna faltando).
-- CASCADE remove sessions e accounts ligados ao usuário.
-- Execute no Supabase: SQL Editor → substitua o email abaixo → Run.
-- =============================================================================

-- Remover um ou mais emails (troque ou adicione o que precisar)
DELETE FROM next_auth.users
WHERE email IN (
  'thiagochimezie44@gmail.com',
  'thiagochimezie4@gmail.com'
);
-- accounts e sessions são removidos em cascata pela FK.

-- Para conferir depois (opcional):
-- SELECT id, email, name FROM next_auth.users;
