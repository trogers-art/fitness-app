alter table public.user_profiles
  add column if not exists theme text not null default 'default'
  check (theme in ('default', 'dark', 'light'));
