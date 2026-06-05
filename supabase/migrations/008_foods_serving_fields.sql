alter table public.foods
  add column if not exists serving_description text,
  add column if not exists serving_calories    integer,
  add column if not exists serving_protein     numeric(6,1),
  add column if not exists serving_carbs       numeric(6,1),
  add column if not exists serving_fat         numeric(6,1),
  add column if not exists servings_json       text;
