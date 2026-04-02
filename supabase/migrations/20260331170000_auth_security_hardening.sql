alter table if exists public.auth_local_users
  add column if not exists email_verified_at timestamptz,
  add column if not exists email_verify_token_hash text,
  add column if not exists email_verify_expires_at timestamptz,
  add column if not exists password_reset_token_hash text,
  add column if not exists password_reset_expires_at timestamptz,
  add column if not exists password_reset_used_at timestamptz,
  add column if not exists failed_login_attempts integer not null default 0,
  add column if not exists lockout_until timestamptz,
  add column if not exists last_login_ip text,
  add column if not exists last_login_at timestamptz,
  add column if not exists totp_secret text,
  add column if not exists totp_enabled_at timestamptz;
