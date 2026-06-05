create table public.meal_templates (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  description text,
  meal_type   text check (meal_type in ('breakfast','lunch','dinner','snack','pre_workout','post_workout')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.meal_template_items (
  id               uuid primary key default uuid_generate_v4(),
  template_id      uuid not null references public.meal_templates(id) on delete cascade,
  food_id          uuid not null references public.foods(id),
  quantity_g       numeric(7,1) not null check (quantity_g > 0),
  order_index      integer not null default 0
);

create index meal_templates_user_id_idx on public.meal_templates(user_id);
create index meal_template_items_template_id_idx on public.meal_template_items(template_id);

alter table public.meal_templates enable row level security;
alter table public.meal_template_items enable row level security;

create policy "meal_templates_select" on public.meal_templates for select using (auth.uid() = user_id);
create policy "meal_templates_insert" on public.meal_templates for insert with check (auth.uid() = user_id);
create policy "meal_templates_update" on public.meal_templates for update using (auth.uid() = user_id);
create policy "meal_templates_delete" on public.meal_templates for delete using (auth.uid() = user_id);

create policy "meal_template_items_select" on public.meal_template_items for select
  using (exists (select 1 from public.meal_templates t where t.id = template_id and t.user_id = auth.uid()));
create policy "meal_template_items_insert" on public.meal_template_items for insert
  with check (exists (select 1 from public.meal_templates t where t.id = template_id and t.user_id = auth.uid()));
create policy "meal_template_items_delete" on public.meal_template_items for delete
  using (exists (select 1 from public.meal_templates t where t.id = template_id and t.user_id = auth.uid()));
