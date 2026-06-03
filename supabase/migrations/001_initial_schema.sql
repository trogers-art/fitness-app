-- ============================================================
-- 001_initial_schema.sql
-- Full initial schema for the fitness & health platform
-- ============================================================

create extension if not exists "uuid-ossp";

-- ─── user_profiles ────────────────────────────────────────────────────────

create table public.user_profiles (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null unique references auth.users(id) on delete cascade,
  age             integer not null check (age between 13 and 100),
  sex             text not null check (sex in ('male', 'female')),
  height_cm       numeric(5,1) not null,
  weight_kg       numeric(5,1) not null,
  activity_level  text not null check (activity_level in ('sedentary','light','moderate','active','very_active')),
  timezone        text not null default 'UTC',
  goal            text not null check (goal in ('fat_loss','muscle_gain','maintain')),
  target_rate_kg_per_week numeric(3,2) not null default 0.5,
  bmr             integer not null,
  tdee            integer not null,
  daily_calories  integer not null,
  protein_g       integer not null,
  carbs_g         integer not null,
  fat_g           integer not null,
  training_day_carbs_g integer not null,
  rest_day_carbs_g     integer not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.user_profiles enable row level security;
create policy "user_profiles_select" on public.user_profiles for select using (auth.uid() = user_id);
create policy "user_profiles_insert" on public.user_profiles for insert with check (auth.uid() = user_id);
create policy "user_profiles_update" on public.user_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_profiles_delete" on public.user_profiles for delete using (auth.uid() = user_id);

-- ─── habits ───────────────────────────────────────────────────────────────

create table public.habits (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  frequency     text not null check (frequency in ('daily','weekly')),
  category      text not null check (category in ('sleep','hydration','nutrition','movement','mindset','other')),
  reminder_time text check (reminder_time ~ '^\d{2}:\d{2}$'),
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create index habits_user_id_idx on public.habits(user_id);
alter table public.habits enable row level security;
create policy "habits_select" on public.habits for select using (auth.uid() = user_id);
create policy "habits_insert" on public.habits for insert with check (auth.uid() = user_id);
create policy "habits_update" on public.habits for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "habits_delete" on public.habits for delete using (auth.uid() = user_id);

-- ─── habit_logs ───────────────────────────────────────────────────────────

create table public.habit_logs (
  id           uuid primary key default uuid_generate_v4(),
  habit_id     uuid not null references public.habits(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  completed_at timestamptz not null default now(),
  note         text
);

create index habit_logs_habit_id_idx on public.habit_logs(habit_id);
create index habit_logs_user_date_idx on public.habit_logs(user_id, completed_at);
alter table public.habit_logs enable row level security;
create policy "habit_logs_select" on public.habit_logs for select using (auth.uid() = user_id);
create policy "habit_logs_insert" on public.habit_logs for insert with check (auth.uid() = user_id);
create policy "habit_logs_update" on public.habit_logs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "habit_logs_delete" on public.habit_logs for delete using (auth.uid() = user_id);

-- ─── foods ────────────────────────────────────────────────────────────────

create table public.foods (
  id                 uuid primary key default uuid_generate_v4(),
  barcode            text,
  name               text not null,
  brand              text,
  calories_per_100g  numeric(7,1) not null,
  protein_per_100g   numeric(6,2) not null,
  carbs_per_100g     numeric(6,2) not null,
  fat_per_100g       numeric(6,2) not null,
  fibre_per_100g     numeric(6,2),
  sugar_per_100g     numeric(6,2),
  sodium_per_100g    numeric(8,4),
  source             text not null check (source in ('openfoodfacts','usda','custom')),
  user_id            uuid references auth.users(id) on delete cascade,
  created_at         timestamptz not null default now()
);

create index foods_barcode_idx on public.foods(barcode) where barcode is not null;
create index foods_name_idx on public.foods using gin (to_tsvector('english', name));
create index foods_user_id_idx on public.foods(user_id) where user_id is not null;

alter table public.foods enable row level security;
create policy "foods_select" on public.foods for select using (user_id is null or auth.uid() = user_id);
create policy "foods_insert_custom" on public.foods for insert with check (auth.uid() = user_id);
create policy "foods_insert_global" on public.foods for insert with check (user_id is null);
create policy "foods_update" on public.foods for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "foods_delete" on public.foods for delete using (auth.uid() = user_id);

-- ─── meal_plans ───────────────────────────────────────────────────────────

create table public.meal_plans (
  id                   uuid primary key default uuid_generate_v4(),
  user_id              uuid not null unique references auth.users(id) on delete cascade,
  ai_generated         boolean not null default true,
  daily_targets        jsonb not null,
  training_day_meals   jsonb not null,
  rest_day_meals       jsonb not null,
  notes                text not null default '',
  updated_at           timestamptz not null default now(),
  created_at           timestamptz not null default now()
);

alter table public.meal_plans enable row level security;
create policy "meal_plans_select" on public.meal_plans for select using (auth.uid() = user_id);
create policy "meal_plans_insert" on public.meal_plans for insert with check (auth.uid() = user_id);
create policy "meal_plans_update" on public.meal_plans for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "meal_plans_delete" on public.meal_plans for delete using (auth.uid() = user_id);

-- ─── food_entries ─────────────────────────────────────────────────────────

create table public.food_entries (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  food_id          uuid not null references public.foods(id),
  meal_type        text not null check (meal_type in ('breakfast','lunch','dinner','snack','pre_workout','post_workout')),
  quantity_g       numeric(7,1) not null check (quantity_g > 0),
  logged_at        timestamptz not null default now(),
  is_training_day  boolean not null default false
);

create index food_entries_user_date_idx on public.food_entries(user_id, logged_at);
alter table public.food_entries enable row level security;
create policy "food_entries_select" on public.food_entries for select using (auth.uid() = user_id);
create policy "food_entries_insert" on public.food_entries for insert with check (auth.uid() = user_id);
create policy "food_entries_update" on public.food_entries for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "food_entries_delete" on public.food_entries for delete using (auth.uid() = user_id);

-- ─── daily_nutrition_summaries ────────────────────────────────────────────

create table public.daily_nutrition_summaries (
  id                        uuid primary key default uuid_generate_v4(),
  user_id                   uuid not null references auth.users(id) on delete cascade,
  date                      date not null,
  total_calories            integer not null default 0,
  protein_g                 numeric(6,1) not null default 0,
  carbs_g                   numeric(6,1) not null default 0,
  fat_g                     numeric(6,1) not null default 0,
  fibre_g                   numeric(6,1) not null default 0,
  workout_calories_burned   integer not null default 0,
  net_calories              integer not null default 0,
  is_training_day           boolean not null default false,
  unique(user_id, date)
);

create index dns_user_date_idx on public.daily_nutrition_summaries(user_id, date);
alter table public.daily_nutrition_summaries enable row level security;
create policy "dns_select" on public.daily_nutrition_summaries for select using (auth.uid() = user_id);
create policy "dns_insert" on public.daily_nutrition_summaries for insert with check (auth.uid() = user_id);
create policy "dns_update" on public.daily_nutrition_summaries for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "dns_delete" on public.daily_nutrition_summaries for delete using (auth.uid() = user_id);

-- ─── exercises ────────────────────────────────────────────────────────────

create table public.exercises (
  id                uuid primary key default uuid_generate_v4(),
  name              text not null,
  muscle_group      text not null,
  secondary_muscles text[] not null default '{}',
  equipment         text[] not null default '{}',
  type              text not null check (type in ('compound','isolation','cardio','mobility')),
  instructions      text[] not null default '{}',
  gif_url           text,
  source            text not null default 'free-exercise-db',
  user_id           uuid references auth.users(id) on delete cascade,
  created_at        timestamptz not null default now()
);

create index exercises_muscle_idx on public.exercises(muscle_group);
create index exercises_name_fts_idx on public.exercises using gin (to_tsvector('english', name));
create index exercises_user_id_idx on public.exercises(user_id) where user_id is not null;

alter table public.exercises enable row level security;
create policy "exercises_select" on public.exercises for select using (user_id is null or auth.uid() = user_id);
create policy "exercises_insert_custom" on public.exercises for insert with check (auth.uid() = user_id);
create policy "exercises_insert_global" on public.exercises for insert with check (user_id is null);
create policy "exercises_update" on public.exercises for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "exercises_delete" on public.exercises for delete using (auth.uid() = user_id);

-- ─── programs ─────────────────────────────────────────────────────────────

create table public.programs (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  name           text not null,
  goal           text not null check (goal in ('fat_loss','muscle_gain','maintain')),
  duration_weeks integer not null,
  days_per_week  integer not null check (days_per_week between 1 and 7),
  ai_generated   boolean not null default false,
  template       boolean not null default false,
  active         boolean not null default false,
  started_at     timestamptz,
  completed_at   timestamptz,
  created_at     timestamptz not null default now()
);

create index programs_user_id_idx on public.programs(user_id);
alter table public.programs enable row level security;
create policy "programs_select" on public.programs for select using (auth.uid() = user_id);
create policy "programs_insert" on public.programs for insert with check (auth.uid() = user_id);
create policy "programs_update" on public.programs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "programs_delete" on public.programs for delete using (auth.uid() = user_id);

-- ─── program_weeks ────────────────────────────────────────────────────────

create table public.program_weeks (
  id           uuid primary key default uuid_generate_v4(),
  program_id   uuid not null references public.programs(id) on delete cascade,
  week_number  integer not null check (week_number > 0),
  is_deload    boolean not null default false
);

create index program_weeks_program_id_idx on public.program_weeks(program_id);
alter table public.program_weeks enable row level security;
create policy "program_weeks_select" on public.program_weeks for select
  using (exists (select 1 from public.programs p where p.id = program_id and p.user_id = auth.uid()));
create policy "program_weeks_insert" on public.program_weeks for insert
  with check (exists (select 1 from public.programs p where p.id = program_id and p.user_id = auth.uid()));
create policy "program_weeks_update" on public.program_weeks for update
  using (exists (select 1 from public.programs p where p.id = program_id and p.user_id = auth.uid()));
create policy "program_weeks_delete" on public.program_weeks for delete
  using (exists (select 1 from public.programs p where p.id = program_id and p.user_id = auth.uid()));

-- ─── sessions ─────────────────────────────────────────────────────────────

create table public.sessions (
  id               uuid primary key default uuid_generate_v4(),
  program_week_id  uuid not null references public.program_weeks(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  day_of_week      integer not null check (day_of_week between 1 and 7),
  focus            text not null,
  planned          boolean not null default true,
  performed_at     timestamptz
);

create index sessions_user_id_idx on public.sessions(user_id);
create index sessions_program_week_id_idx on public.sessions(program_week_id);
alter table public.sessions enable row level security;
create policy "sessions_select" on public.sessions for select using (auth.uid() = user_id);
create policy "sessions_insert" on public.sessions for insert with check (auth.uid() = user_id);
create policy "sessions_update" on public.sessions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sessions_delete" on public.sessions for delete using (auth.uid() = user_id);

-- ─── session_exercises ────────────────────────────────────────────────────

create table public.session_exercises (
  id                uuid primary key default uuid_generate_v4(),
  session_id        uuid not null references public.sessions(id) on delete cascade,
  exercise_id       uuid not null references public.exercises(id),
  order_index       integer not null default 0,
  target_sets       integer not null check (target_sets > 0),
  target_reps       text not null,
  target_weight_kg  numeric(6,2),
  rest_seconds      integer not null default 90
);

create index se_session_id_idx on public.session_exercises(session_id);
alter table public.session_exercises enable row level security;
create policy "session_exercises_select" on public.session_exercises for select
  using (exists (select 1 from public.sessions s where s.id = session_id and s.user_id = auth.uid()));
create policy "session_exercises_insert" on public.session_exercises for insert
  with check (exists (select 1 from public.sessions s where s.id = session_id and s.user_id = auth.uid()));
create policy "session_exercises_update" on public.session_exercises for update
  using (exists (select 1 from public.sessions s where s.id = session_id and s.user_id = auth.uid()));
create policy "session_exercises_delete" on public.session_exercises for delete
  using (exists (select 1 from public.sessions s where s.id = session_id and s.user_id = auth.uid()));

-- ─── exercise_sets ────────────────────────────────────────────────────────

create table public.exercise_sets (
  id                    uuid primary key default uuid_generate_v4(),
  session_exercise_id   uuid not null references public.session_exercises(id) on delete cascade,
  set_number            integer not null check (set_number > 0),
  reps                  integer not null check (reps > 0),
  weight_kg             numeric(6,2) not null default 0,
  rpe                   numeric(3,1) check (rpe between 1 and 10),
  completed             boolean not null default false,
  completed_at          timestamptz
);

create index exercise_sets_se_id_idx on public.exercise_sets(session_exercise_id);
alter table public.exercise_sets enable row level security;
create policy "exercise_sets_select" on public.exercise_sets for select
  using (exists (
    select 1 from public.session_exercises se
    join public.sessions s on s.id = se.session_id
    where se.id = session_exercise_id and s.user_id = auth.uid()
  ));
create policy "exercise_sets_insert" on public.exercise_sets for insert
  with check (exists (
    select 1 from public.session_exercises se
    join public.sessions s on s.id = se.session_id
    where se.id = session_exercise_id and s.user_id = auth.uid()
  ));
create policy "exercise_sets_update" on public.exercise_sets for update
  using (exists (
    select 1 from public.session_exercises se
    join public.sessions s on s.id = se.session_id
    where se.id = session_exercise_id and s.user_id = auth.uid()
  ));
create policy "exercise_sets_delete" on public.exercise_sets for delete
  using (exists (
    select 1 from public.session_exercises se
    join public.sessions s on s.id = se.session_id
    where se.id = session_exercise_id and s.user_id = auth.uid()
  ));

-- ─── workout_logs ─────────────────────────────────────────────────────────

create table public.workout_logs (
  id                    uuid primary key default uuid_generate_v4(),
  session_id            uuid not null references public.sessions(id),
  user_id               uuid not null references auth.users(id) on delete cascade,
  duration_minutes      integer not null,
  calories_burned_est   integer not null default 0,
  notes                 text,
  completed_at          timestamptz not null default now()
);

create index workout_logs_user_id_idx on public.workout_logs(user_id);
alter table public.workout_logs enable row level security;
create policy "workout_logs_select" on public.workout_logs for select using (auth.uid() = user_id);
create policy "workout_logs_insert" on public.workout_logs for insert with check (auth.uid() = user_id);
create policy "workout_logs_update" on public.workout_logs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "workout_logs_delete" on public.workout_logs for delete using (auth.uid() = user_id);

-- ─── body_metrics ─────────────────────────────────────────────────────────

create table public.body_metrics (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  logged_at     timestamptz not null default now(),
  weight_kg     numeric(5,2) not null,
  body_fat_pct  numeric(4,1),
  waist_cm      numeric(5,1),
  hips_cm       numeric(5,1),
  chest_cm      numeric(5,1),
  arms_cm       numeric(4,1),
  thighs_cm     numeric(4,1),
  note          text
);

create index body_metrics_user_date_idx on public.body_metrics(user_id, logged_at);
alter table public.body_metrics enable row level security;
create policy "body_metrics_select" on public.body_metrics for select using (auth.uid() = user_id);
create policy "body_metrics_insert" on public.body_metrics for insert with check (auth.uid() = user_id);
create policy "body_metrics_update" on public.body_metrics for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "body_metrics_delete" on public.body_metrics for delete using (auth.uid() = user_id);

-- ─── ai_plans ─────────────────────────────────────────────────────────────

create table public.ai_plans (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  type          text not null check (type in ('food','fitness','checkin')),
  response_json jsonb not null,
  created_at    timestamptz not null default now()
);

create index ai_plans_user_id_idx on public.ai_plans(user_id);
alter table public.ai_plans enable row level security;
create policy "ai_plans_select" on public.ai_plans for select using (auth.uid() = user_id);
create policy "ai_plans_insert" on public.ai_plans for insert with check (auth.uid() = user_id);
create policy "ai_plans_delete" on public.ai_plans for delete using (auth.uid() = user_id);

-- ─── checkin_logs ─────────────────────────────────────────────────────────

create table public.checkin_logs (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  week_start   date not null,
  inputs       jsonb not null,
  outputs      jsonb not null,
  explanation  text not null,
  created_at   timestamptz not null default now()
);

create index checkin_logs_user_id_idx on public.checkin_logs(user_id);
alter table public.checkin_logs enable row level security;
create policy "checkin_logs_select" on public.checkin_logs for select using (auth.uid() = user_id);
create policy "checkin_logs_insert" on public.checkin_logs for insert with check (auth.uid() = user_id);
create policy "checkin_logs_delete" on public.checkin_logs for delete using (auth.uid() = user_id);

-- ─── push_subscriptions ───────────────────────────────────────────────────

create table public.push_subscriptions (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  endpoint   text not null,
  keys_json  jsonb not null,
  created_at timestamptz not null default now(),
  unique(user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;
create policy "push_select" on public.push_subscriptions for select using (auth.uid() = user_id);
create policy "push_insert" on public.push_subscriptions for insert with check (auth.uid() = user_id);
create policy "push_delete" on public.push_subscriptions for delete using (auth.uid() = user_id);
