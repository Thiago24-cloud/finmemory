-- =============================================================================
-- Corrige "permission denied for schema next_auth" (42501) no callback do NextAuth
-- Execute no Supabase: SQL Editor → New query → Cole e rode.
-- =============================================================================

-- Schema: USAGE para as roles que o PostgREST pode usar
GRANT USAGE ON SCHEMA next_auth TO service_role;
GRANT USAGE ON SCHEMA next_auth TO authenticator;
GRANT USAGE ON SCHEMA next_auth TO anon;
GRANT USAGE ON SCHEMA next_auth TO authenticated;

-- Tabelas: SELECT, INSERT, UPDATE, DELETE (o adapter usa service_role; authenticator precisa para o fluxo)
GRANT ALL ON TABLE next_auth.users TO service_role, authenticator;
GRANT ALL ON TABLE next_auth.sessions TO service_role, authenticator;
GRANT ALL ON TABLE next_auth.accounts TO service_role, authenticator;
GRANT ALL ON TABLE next_auth.verification_tokens TO service_role, authenticator;

-- Sequences (se existirem) e default para novas linhas
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA next_auth TO service_role, authenticator;
