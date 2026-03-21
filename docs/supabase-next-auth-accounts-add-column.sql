-- =============================================================================
-- Corrige adapter_error_linkAccount / PGRST204: coluna refresh_token_expires_in
-- O NextAuth pode enviar esse campo ao salvar a conta OAuth (ex.: Google).
-- Execute no Supabase: SQL Editor → New query → Cole e rode.
-- =============================================================================

ALTER TABLE next_auth.accounts
ADD COLUMN IF NOT EXISTS refresh_token_expires_in integer;

COMMENT ON COLUMN next_auth.accounts.refresh_token_expires_in IS 'Tempo de vida do refresh_token em segundos (provider-specific)';
