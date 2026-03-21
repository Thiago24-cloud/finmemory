-- =============================================================================
-- Schema NextAuth para Supabase (@next-auth/supabase-adapter)
-- Execute no Supabase: SQL Editor → New query → Cole e rode.
-- Fonte: node_modules/@next-auth/supabase-adapter/supabase/migrations/20221108043803_create_next_auth_schema.sql
-- =============================================================================

-- Habilitar extensão para uuid_generate_v4() (Supabase costuma já ter)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

--
-- Schema next_auth
--
CREATE SCHEMA IF NOT EXISTS next_auth;

GRANT USAGE ON SCHEMA next_auth TO service_role, authenticator, anon, authenticated;
GRANT ALL ON SCHEMA next_auth TO postgres;

--
-- Tabela users (NextAuth)
--
CREATE TABLE IF NOT EXISTS next_auth.users
(
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    name text,
    email text,
    "emailVerified" timestamp with time zone,
    image text,
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT email_unique UNIQUE (email)
);

GRANT ALL ON TABLE next_auth.users TO postgres, service_role, authenticator;

-- Função uid() usada em RLS (pode ser usada por outras tabelas)
CREATE OR REPLACE FUNCTION next_auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select 
    coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    )::uuid
$$;

--
-- Tabela sessions
--
CREATE TABLE IF NOT EXISTS next_auth.sessions
(
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    expires timestamp with time zone NOT NULL,
    "sessionToken" text NOT NULL,
    "userId" uuid,
    CONSTRAINT sessions_pkey PRIMARY KEY (id),
    CONSTRAINT sessionToken_unique UNIQUE ("sessionToken"),
    CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId")
        REFERENCES next_auth.users (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE
);

GRANT ALL ON TABLE next_auth.sessions TO postgres, service_role, authenticator;

--
-- Tabela accounts (OAuth: Google, etc.)
--
CREATE TABLE IF NOT EXISTS next_auth.accounts
(
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    type text NOT NULL,
    provider text NOT NULL,
    "providerAccountId" text NOT NULL,
    refresh_token text,
    access_token text,
    expires_at bigint,
    token_type text,
    scope text,
    id_token text,
    session_state text,
    oauth_token_secret text,
    oauth_token text,
    "userId" uuid,
    refresh_token_expires_in integer,
    CONSTRAINT accounts_pkey PRIMARY KEY (id),
    CONSTRAINT provider_unique UNIQUE (provider, "providerAccountId"),
    CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId")
        REFERENCES next_auth.users (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE
);

GRANT ALL ON TABLE next_auth.accounts TO postgres, service_role, authenticator;

--
-- Tabela verification_tokens
--
CREATE TABLE IF NOT EXISTS next_auth.verification_tokens
(
    identifier text,
    token text,
    expires timestamp with time zone NOT NULL,
    CONSTRAINT verification_tokens_pkey PRIMARY KEY (token),
    CONSTRAINT token_unique UNIQUE (token),
    CONSTRAINT token_identifier_unique UNIQUE (token, identifier)
);

GRANT ALL ON TABLE next_auth.verification_tokens TO postgres, service_role, authenticator;

-- =============================================================================
-- Expor o schema next_auth na API (evita PGRST106 / adapter_error_getUserByAccount)
-- Execute no Supabase: SQL Editor → New query → Cole e rode.
-- =============================================================================
ALTER ROLE authenticator SET pgrst.db_schemas = 'public, graphql_public, next_auth';
NOTIFY pgrst;
