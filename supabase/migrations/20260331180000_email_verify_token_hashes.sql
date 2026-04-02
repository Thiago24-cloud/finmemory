-- Vários hashes de confirmação válidos em paralelo (reenvio não invalida links antigos até expirar)
alter table if exists public.auth_local_users
  add column if not exists email_verify_token_hashes text[];

update public.auth_local_users
set email_verify_token_hashes = array[email_verify_token_hash]
where email_verify_token_hash is not null
  and email_verify_token_hashes is null;
