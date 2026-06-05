alter table public.foods
  add column if not exists serving_size_g numeric(7,1);
