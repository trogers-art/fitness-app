create table if not exists public.workout_logs (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  program_id   uuid references public.programs(id) on delete set null,
  session_id   uuid references public.sessions(id) on delete set null,
  name         text not null,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  duration_seconds integer,
  notes        text
);

create table if not exists public.workout_log_sets (
  id              uuid primary key default uuid_generate_v4(),
  workout_log_id  uuid not null references public.workout_logs(id) on delete cascade,
  exercise_id     uuid not null references public.exercises(id),
  exercise_name   text not null,
  set_number      integer not null,
  weight_kg       numeric(6,2),
  reps            integer,
  completed       boolean not null default true,
  logged_at       timestamptz not null default now()
);

create index if not exists workout_logs_user_id_idx on public.workout_logs(user_id);
create index if not exists workout_log_sets_log_id_idx on public.workout_log_sets(workout_log_id);

alter table public.workout_logs enable row level security;
alter table public.workout_log_sets enable row level security;

create policy "workout_logs_select" on public.workout_logs for select using (auth.uid() = user_id);
create policy "workout_logs_insert" on public.workout_logs for insert with check (auth.uid() = user_id);
create policy "workout_logs_update" on public.workout_logs for update using (auth.uid() = user_id);
create policy "workout_logs_delete" on public.workout_logs for delete using (auth.uid() = user_id);

create policy "workout_log_sets_select" on public.workout_log_sets for select
  using (exists (select 1 from public.workout_logs l where l.id = workout_log_id and l.user_id = auth.uid()));
create policy "workout_log_sets_insert" on public.workout_log_sets for insert
  with check (exists (select 1 from public.workout_logs l where l.id = workout_log_id and l.user_id = auth.uid()));
create policy "workout_log_sets_delete" on public.workout_log_sets for delete
  using (exists (select 1 from public.workout_logs l where l.id = workout_log_id and l.user_id = auth.uid()));
