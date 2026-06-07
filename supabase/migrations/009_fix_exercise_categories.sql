-- Fix muscle groups for exercises that fell through to full_body
-- These map free-exercise-db categories that were missing from the original seed

-- Stretching exercises → map by name keywords
update public.exercises set muscle_group = 'hamstrings'
where user_id is null and source = 'free-exercise-db'
and (lower(name) like '%hamstring%');

update public.exercises set muscle_group = 'quads'
where user_id is null and source = 'free-exercise-db'
and (lower(name) like '%quad%' or lower(name) like '%squat%' or lower(name) like '%lunge%' or lower(name) like '%leg press%' or lower(name) like '%leg extension%');

update public.exercises set muscle_group = 'glutes'
where user_id is null and source = 'free-exercise-db'
and (lower(name) like '%glute%' or lower(name) like '%hip thrust%' or lower(name) like '%hip extension%');

update public.exercises set muscle_group = 'calves'
where user_id is null and source = 'free-exercise-db'
and (lower(name) like '%calf%' or lower(name) like '%calves%' or lower(name) like '%gastrocnem%');

update public.exercises set muscle_group = 'chest'
where user_id is null and source = 'free-exercise-db'
and (lower(name) like '%chest%' or lower(name) like '%pec%' or lower(name) like '%bench press%' or lower(name) like '%push-up%' or lower(name) like '%push up%' or lower(name) like '%pushup%');

update public.exercises set muscle_group = 'back'
where user_id is null and source = 'free-exercise-db'
and (lower(name) like '%lat%' or lower(name) like '%row%' or lower(name) like '%deadlift%' or lower(name) like '%pull-up%' or lower(name) like '%pullup%' or lower(name) like '%pull up%' or lower(name) like '%chin-up%' or lower(name) like '%back%');

update public.exercises set muscle_group = 'shoulders'
where user_id is null and source = 'free-exercise-db'
and (lower(name) like '%shoulder%' or lower(name) like '%delt%' or lower(name) like '%press%' or lower(name) like '%raise%')
and muscle_group = 'full_body';

update public.exercises set muscle_group = 'biceps'
where user_id is null and source = 'free-exercise-db'
and (lower(name) like '%bicep%' or lower(name) like '%curl%')
and muscle_group = 'full_body';

update public.exercises set muscle_group = 'triceps'
where user_id is null and source = 'free-exercise-db'
and (lower(name) like '%tricep%' or lower(name) like '%skull%' or lower(name) like '%pushdown%' or lower(name) like '%extension%')
and muscle_group = 'full_body';

update public.exercises set muscle_group = 'core'
where user_id is null and source = 'free-exercise-db'
and (lower(name) like '%ab%' or lower(name) like '%core%' or lower(name) like '%crunch%' or lower(name) like '%plank%' or lower(name) like '%sit-up%' or lower(name) like '%sit up%')
and muscle_group = 'full_body';

update public.exercises set muscle_group = 'cardio'
where user_id is null and source = 'free-exercise-db'
and (lower(name) like '%run%' or lower(name) like '%sprint%' or lower(name) like '%jump%' or lower(name) like '%burpee%' or lower(name) like '%cardio%')
and muscle_group = 'full_body';

-- Fix equipment: map 'other' to more specific based on name
update public.exercises set equipment = '["barbell"]'::jsonb
where user_id is null and source = 'free-exercise-db'
and equipment = '["other"]'::jsonb
and (lower(name) like '%barbell%' or lower(name) like '%deadlift%' or lower(name) like '%squat%');

update public.exercises set equipment = '["dumbbell"]'::jsonb
where user_id is null and source = 'free-exercise-db'
and equipment = '["other"]'::jsonb
and lower(name) like '%dumbbell%';

update public.exercises set equipment = '["bodyweight"]'::jsonb
where user_id is null and source = 'free-exercise-db'
and equipment = '["other"]'::jsonb
and (lower(name) like '%stretch%' or lower(name) like '%mobility%' or lower(name) like '%flexibility%' or lower(name) like '%yoga%');
