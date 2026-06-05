-- Store FatSecret food_id for detail lookups
alter table public.foods
  add column if not exists fs_food_id text;

create index if not exists foods_fs_food_id_idx on public.foods(fs_food_id) where fs_food_id is not null;

-- Store serving info directly on entries so diary shows real serving names
alter table public.food_entries
  add column if not exists serving_description text,
  add column if not exists calories_total      integer,
  add column if not exists protein_total       numeric(6,1),
  add column if not exists carbs_total         numeric(6,1),
  add column if not exists fat_total           numeric(6,1);
