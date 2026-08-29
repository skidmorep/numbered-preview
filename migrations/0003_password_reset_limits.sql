create table if not exists password_reset_limits (
  key text primary key,
  attempts integer not null,
  window_started text not null,
  last_requested_at text not null
);
create index if not exists idx_password_reset_limits_window on password_reset_limits(window_started);
