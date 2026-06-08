alter table public.ai_plans
  add column if not exists plan_type text,
  add column if not exists plan_data jsonb;

-- Backfill from existing columns where possible
update public.ai_plans set plan_type = type, plan_data = response_json
where plan_type is null;
