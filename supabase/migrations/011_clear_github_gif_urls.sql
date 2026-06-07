-- Clear stale GitHub raw image URLs — ExerciseDB will repopulate on demand
update public.exercises
set gif_url = null
where gif_url like '%githubusercontent.com%';
