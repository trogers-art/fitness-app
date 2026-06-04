-- Partial unique index on global foods (user_id is null) to allow upsert by name
create unique index if not exists foods_global_name_unique
  on public.foods (lower(name))
  where user_id is null;
