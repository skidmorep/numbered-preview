create table if not exists admin_users (
  id text primary key,
  username text not null unique,
  email text not null unique,
  password_hash text not null,
  role text not null check (role in ('owner', 'editor')),
  force_password_change integer not null default 1,
  disabled integer not null default 0,
  created_at text not null,
  updated_at text not null
);

create table if not exists admin_sessions (
  id text primary key,
  user_id text not null references admin_users(id),
  token_hash text not null unique,
  expires_at text not null,
  created_at text not null
);
create index if not exists idx_admin_sessions_token on admin_sessions(token_hash);
create index if not exists idx_admin_sessions_expiry on admin_sessions(expires_at);

create table if not exists login_attempts (
  key text primary key,
  attempts integer not null,
  window_started text not null,
  blocked_until text
);

create table if not exists site_state (
  id integer primary key check (id = 1),
  content_json text not null,
  revision integer not null,
  updated_by text not null references admin_users(id),
  updated_at text not null
);

create table if not exists site_revisions (
  revision integer primary key,
  content_json text not null,
  created_by text not null references admin_users(id),
  created_at text not null
);

create table if not exists site_media (
  id text primary key,
  object_key text not null unique,
  media_type text not null,
  byte_size integer not null,
  alt_text text not null default '',
  created_by text not null references admin_users(id),
  created_at text not null
);
