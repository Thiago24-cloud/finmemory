-- Garante que auth_local_users tem todas as colunas necessárias.
-- Execute no SQL Editor do Supabase se as migrações não foram aplicadas.

alter table if exists public.auth_local_users
  add column if not exists email_verified_at         timestamptz,
  add column if not exists email_verify_token_hash   text,
  add column if not exists email_verify_token_hashes text[],
  add column if not exists email_verify_expires_at   timestamptz,
  add column if not exists password_reset_token_hash  text,
  add column if not exists password_reset_expires_at  timestamptz,
  add column if not exists password_reset_used_at     timestamptz,
  add column if not exists failed_login_attempts      integer not null default 0,
  add column if not exists lockout_until              timestamptz,
  add column if not exists last_login_ip              text,
  add column if not exists last_login_at              timestamptz,
  add column if not exists totp_secret                text,
  add column if not exists totp_enabled_at            timestamptz;

-- Garante política service_role (contorna RLS para operações de servidor)
drop policy if exists "service_role bypass auth_local_users" on public.auth_local_users;
create policy "service_role bypass auth_local_users"
  on public.auth_local_users for all
  to service_role
  using (true)
  with check (true);

-- Reseta contas com tentativas falhas excessivas (manutenção)
-- update public.auth_local_users set failed_login_attempts = 0, lockout_until = null where failed_login_attempts > 0;
