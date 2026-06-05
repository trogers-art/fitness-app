alter table public.user_profiles
  add column if not exists units text not null default 'imperial'
  check (units in ('imperial', 'metric'));
