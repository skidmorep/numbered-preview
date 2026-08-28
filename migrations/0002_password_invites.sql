create table if not exists password_invites (
  id text primary key,
  user_id text not null references admin_users(id),
  token_hash text not null unique,
  expires_at text not null,
  used_at text,
  created_at text not null
);
create index if not exists idx_password_invites_token on password_invites(token_hash);
create index if not exists idx_password_invites_expiry on password_invites(expires_at);
