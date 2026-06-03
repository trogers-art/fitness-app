# Build log & requirements
**Project:** Fitness & Health Platform  
**Stack:** Next.js (App Router) · Supabase · Vercel · GitHub  
**Status:** Pre-build · scoping complete  
**Last updated:** 2026-06-03

---

## Table of contents

1. [Project overview](#1-project-overview)
2. [Tech stack & services](#2-tech-stack--services)
3. [App modules](#3-app-modules)
4. [AI layer](#4-ai-layer)
5. [Database schema](#5-database-schema)
6. [API routes](#6-api-routes)
7. [Third-party integrations](#7-third-party-integrations)
8. [Build phases](#8-build-phases)
9. [Requirements checklist](#9-requirements-checklist)
10. [Open questions & decisions](#10-open-questions--decisions)

---

## 1. Project overview

A unified personal health platform with four interconnected modules. The core differentiator is an AI layer that computes personalised targets from biometric data and generates correlated food and fitness plans — then adapts both weekly based on actual results.

**Four modules:**
- Habit Tracker
- Workout Builder / Program Manager
- Fat Loss Tracker
- Food Tracker (with barcode scanner)

**Core AI behaviour:**
- On onboarding: compute BMR/TDEE/deficit, generate a food plan and a fitness program simultaneously
- Weekly: run an adaptive check-in that adjusts calorie targets and program load based on the previous 7 days
- All plans are correlated — food calories account for workout burn, program intensity reflects the caloric deficit

---

## 2. Tech stack & services

### Core
| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 14+ (App Router) | SSR for fast load, API routes for AI calls |
| Hosting | Vercel | Auto-deploy from GitHub, preview URLs per branch |
| Database | Supabase (Postgres) | RLS for per-user data isolation |
| Auth | Supabase Auth | Email + Google OAuth |
| Storage | Supabase Storage | Profile photos, future media |
| Repo | GitHub | Vercel connected for CI/CD |

### AI
| Service | Usage |
|---|---|
| Anthropic API (`claude-sonnet-4-6`) | All AI calls (metrics, food plan, fitness plan, weekly check-in) |

### External data
| Service | Usage | Cost |
|---|---|---|
| Open Food Facts API | Barcode → food nutrition data (primary) | Free |
| USDA FoodData Central | Nutrition fallback if Open Food Facts misses | Free (API key required) |
| `free-exercise-db` (GitHub) | Exercise library seed data (~800 exercises) | Free, one-time |

### PWA / Notifications
| Feature | Approach |
|---|---|
| PWA | `next-pwa` or manual manifest + service worker |
| Push notifications | Web Push API via Supabase Edge Functions |
| Offline logging | Service worker cache for food diary and workout logging |

### Validation
| Library | Usage |
|---|---|
| Zod | Validate all AI call JSON responses before Supabase writes |

---

## 3. App modules

### 3.1 Habit tracker

**Purpose:** Daily/weekly habit check-ins with streaks, categories, and progress visualisation.

**Features:**
- [ ] Create habits (name, frequency: daily/weekly, category, icon)
- [ ] Check-in UI — one-tap completion per habit per day
- [ ] Streak tracking — current streak, longest streak
- [ ] Habit categories (sleep, hydration, nutrition, movement, mindset)
- [ ] Weekly completion % chart
- [ ] Push notification reminders (user-set time per habit)
- [ ] Habit score fed into weekly AI check-in (Call 3)

**Key UI screens:**
- Habits home (today's list, check-off)
- Habit detail (streak history, calendar view)
- Add/edit habit form

**Data written:** `habits`, `habit_logs`

---

### 3.2 Workout builder / program manager

**Purpose:** Build custom programs or use AI-generated plans. Log sessions. Track progressive overload.

**Features:**
- [ ] Exercise library (seeded from `free-exercise-db`) — searchable by muscle group, equipment, type
- [ ] Custom exercise creation
- [ ] Program builder — multi-week, multi-day structure
- [ ] AI-generated programs (Call 2B) — user fills goal/days/equipment form, gets full 8-week plan
- [ ] Program templates (10–15 popular programs seeded manually: PPL, 5/3/1, GZCLP, nSuns, StrongLifts 5x5, PHUL, Arnold split, etc.)
- [ ] Active session view — exercise-by-exercise, set/rep/weight logging, rest timer
- [ ] Session history and volume charts
- [ ] 1RM calculator and progression suggestions
- [ ] Calories burned estimate written to shared data for food tracker net calc
- [ ] Workout day flagged so food diary can adjust carbs (carb cycling)

**Key UI screens:**
- Programs list (active, completed, templates)
- Program detail (week/day structure)
- Active session (current exercise, sets, timer)
- Exercise library browser
- Add/edit exercise

**Data written:** `programs`, `program_weeks`, `sessions`, `exercise_sets`, `workout_logs`

---

### 3.3 Fat loss tracker

**Purpose:** Log body weight and measurements. Visualise trends. Project goal date.

**Features:**
- [ ] Daily weight logging (with optional note)
- [ ] Body measurements (waist, hips, chest, arms, thighs — optional)
- [ ] Rolling 7-day average weight (smooths daily fluctuation)
- [ ] Trend chart (actual vs projected)
- [ ] Goal date projection (based on current rate vs target rate)
- [ ] Rate alert — if losing too fast (>0.75kg/wk) or too slow (<0.1kg/wk), surface a warning
- [ ] BMI display (informational)
- [ ] Weekly delta card (this week vs last week)
- [ ] Data fed into weekly AI check-in (Call 3)

**Key UI screens:**
- Body metrics home (today's weight, trend chart, goal projection)
- Log weight / measurements form
- History view (table + chart)

**Data written:** `body_metrics`

---

### 3.4 Food tracker

**Purpose:** Log daily food intake. Track macros and calories. Barcode scan for quick entry.

**Features:**
- [ ] Barcode scanner — camera scan → Open Food Facts lookup → USDA fallback → manual entry fallback
- [ ] Food search (by name, against Open Food Facts + user's custom foods)
- [ ] Meal structure (breakfast, lunch, dinner, snacks, pre/post workout)
- [ ] Daily macro summary (calories, protein, carbs, fat — vs targets)
- [ ] AI-generated meal plan loaded as daily template (from Call 2A)
- [ ] Custom food creation and saved meals
- [ ] Micronutrients view (fibre, sugar, sodium — optional detail)
- [ ] Net calories calculation: `eaten − workout burn = net`
- [ ] Carb cycling: rest day vs training day targets differ
- [ ] Weekly averages surfaced for Call 3 adaptive check-in
- [ ] Water intake tracker (optional, simple)

**Key UI screens:**
- Food diary home (today's meals, macro ring, net calories)
- Add food (scan, search, recent, custom)
- Food detail / edit serving size
- Weekly summary

**Data written:** `food_entries`, `foods` (custom), `daily_nutrition_summaries`

---

## 4. AI layer

### 4.1 Call 1 — metrics computation

**Trigger:** On onboarding form submit, or manually via "Update profile"  
**Type:** Can be deterministic math (no AI required) or an AI call for goal framing  
**Runs in:** Next.js API route `/api/ai/metrics`

**Inputs:**
```json
{
  "age": 32,
  "sex": "male",
  "height_cm": 180,
  "weight_kg": 90,
  "activity_level": "moderate",
  "goal": "fat_loss",
  "target_rate_kg_per_week": 0.5
}
```

**Logic:**
```
BMR = (10 × weight_kg) + (6.25 × height_cm) − (5 × age) + sex_offset
TDEE = BMR × activity_multiplier
daily_calories = TDEE − (target_rate × 1100)   // 1 kg fat ≈ 7,700 kcal
protein_g = weight_kg × 1.8                    // minimum for fat loss
fat_g = daily_calories × 0.25 / 9
carbs_g = (daily_calories − protein_g×4 − fat_g×9) / 4
```

**Output saved to:** `user_profiles`

**Validation:**
- Hard floor: `daily_calories` must be ≥ BMR (never below basal)
- Hard floor: `protein_g` minimum 120g regardless of weight
- Hard ceil: deficit never exceeds 1,000 kcal/day

---

### 4.2 Call 2A — food plan generation

**Trigger:** After Call 1 completes, or when user requests a new food plan  
**Runs in:** Next.js API route `/api/ai/food-plan`  
**Model:** `claude-sonnet-4-6`

**System prompt rules enforced:**
- Goal-appropriate macro split (fat_loss: high protein, moderate carb; muscle_gain: higher carb/cal surplus)
- Minimum 20g protein per meal
- No liquid calories unless protein shake
- Fibre target ≥ 25g/day
- Carb cycling: rest day carbs 20% lower than training day
- Output **must** be valid JSON matching the Zod schema below

**Response Zod schema:**
```ts
const MealPlanSchema = z.object({
  daily_targets: z.object({
    calories: z.number(),
    protein_g: z.number(),
    carbs_g: z.number(),
    fat_g: z.number(),
    fibre_g: z.number(),
  }),
  training_day_meals: z.array(MealSchema),
  rest_day_meals: z.array(MealSchema),
  notes: z.string(),
})
```

**Retry logic:** If JSON parse fails or macros deviate >5% from targets, retry up to 2 times with a correction prompt.

**Output saved to:** `meal_plans`, seeds initial `food_entries` template

---

### 4.3 Call 2B — fitness plan generation

**Trigger:** After Call 1 completes, or when user requests a new program  
**Runs in:** Next.js API route `/api/ai/fitness-plan`  
**Model:** `claude-sonnet-4-6`

**Additional inputs beyond user_profile:**
```json
{
  "days_per_week": 4,
  "experience": "intermediate",
  "equipment": ["barbell", "dumbbells", "pull_up_bar"],
  "program_duration_weeks": 8,
  "session_max_minutes": 60
}
```

**System prompt rules enforced by goal:**

| Goal | Training style | Rep ranges | Progression | Notes |
|---|---|---|---|---|
| `fat_loss` | Hypertrophy + 2x cardio | 8–15 reps | Every 2 weeks | Compounds first, ≤60 min |
| `muscle_gain` | Strength → hypertrophy periodisation | 4–6 / 8–12 | Weekly on main lifts | Deload week 4 and 8 |
| `maintain` | Mixed | 6–15 reps | Every 3 weeks | Flexible structure |

**Exercise validation:** All exercise names in AI response checked against seeded `exercises` table before commit. Unknown names → flag for manual review or fallback to similar exercise.

**Response Zod schema:**
```ts
const FitnessPlanSchema = z.object({
  program_name: z.string(),
  goal: z.enum(['fat_loss','muscle_gain','maintain']),
  weeks: z.array(z.object({
    week_number: z.number(),
    is_deload: z.boolean(),
    sessions: z.array(SessionSchema),
  })),
  progression_notes: z.string(),
})
```

**Output saved to:** `programs`, `program_weeks`, `sessions` (all unpopulated until user starts)

---

### 4.4 Call 3 — weekly adaptive check-in

**Trigger:** Supabase Edge Function cron — every Sunday at 20:00 user's local time  
**Runs in:** Supabase Edge Function `weekly-checkin`  
**Model:** `claude-sonnet-4-6`

**Inputs (last 7 days aggregated from Supabase):**
```json
{
  "user_profile": { ...current targets },
  "avg_calories_eaten": 2080,
  "target_calories": 2048,
  "workouts_completed": 3,
  "workouts_planned": 4,
  "weight_start_of_week": 89.2,
  "weight_end_of_week": 88.6,
  "target_weekly_loss": 0.5,
  "habit_completion_pct": 71
}
```

**Logic the AI applies:**
- If weight loss rate > target by >20%: increase calories by 100–150 (protect muscle)
- If weight loss rate < target by >20%: decrease calories by 100–150 (tighten deficit)
- If workouts <75% completion: maintain or reduce load (deload flag)
- If workouts = 100%: allow progression flag
- Always output a plain-English explanation (shown to user as a notification card)

**Output saved to:** `checkin_logs`, updates `user_profiles.daily_calories` and `user_profiles.updated_at`  
**Push notification:** Sent via Web Push on Monday morning

---

## 5. Database schema

### Tables

```sql
-- Core user data
users                    -- Supabase Auth managed
user_profiles            -- BMR, TDEE, daily_calories, macro targets, goal, updated_at

-- Habits
habits                   -- id, user_id, name, frequency, category, reminder_time, active
habit_logs               -- id, habit_id, user_id, completed_at, note

-- Food
foods                    -- id, barcode, name, brand, calories, protein_g, carbs_g, fat_g, fibre_g, source (openfoodfacts|usda|custom), user_id (null = global)
meal_plans               -- id, user_id, ai_generated, daily_targets, training_day_meals, rest_day_meals, created_at
food_entries             -- id, user_id, food_id, meal_type, quantity_g, logged_at, is_training_day
daily_nutrition_summaries -- id, user_id, date, total_cals, protein_g, carbs_g, fat_g, net_cals (after workout burn)

-- Workouts
exercises                -- id, name, muscle_group, secondary_muscles, equipment, type (compound|isolation), instructions, source
programs                 -- id, user_id, name, goal, duration_weeks, ai_generated, active, started_at
program_weeks            -- id, program_id, week_number, is_deload
sessions                 -- id, program_week_id, user_id, day_of_week, focus, planned (bool), performed_at
exercise_sets            -- id, session_id, exercise_id, set_number, reps, weight_kg, rpe, rest_seconds
workout_logs             -- id, session_id, user_id, duration_minutes, calories_burned_est, notes, completed_at

-- Body metrics
body_metrics             -- id, user_id, logged_at, weight_kg, body_fat_pct, waist_cm, hips_cm, chest_cm, arms_cm, thighs_cm, note

-- AI / system
ai_plans                 -- id, user_id, type (food|fitness|checkin), prompt_hash, response_json, created_at
checkin_logs             -- id, user_id, week_start, inputs_json, outputs_json, explanation, created_at
push_subscriptions       -- id, user_id, endpoint, keys_json, created_at
```

### RLS policies (all tables)

Every table has a policy: `user_id = auth.uid()`. No user can read or write another user's rows. The `exercises` and `foods` (global) tables are readable by all authenticated users (`source != 'custom'`), writable only to the seeding service role.

---

## 6. API routes

### Next.js App Router API routes

```
/api/ai/metrics          POST    Run Call 1, update user_profiles
/api/ai/food-plan        POST    Run Call 2A, write to meal_plans
/api/ai/fitness-plan     POST    Run Call 2B, write to programs/sessions
/api/food/barcode        GET     ?barcode=xxx — Open Food Facts → USDA fallback
/api/food/search         GET     ?q=xxx — search foods table + Open Food Facts
/api/exercises/search    GET     ?q=xxx&muscle=xxx&equipment=xxx
/api/user/profile        GET/PUT Read or update user_profiles
/api/push/subscribe      POST    Save push subscription to push_subscriptions
```

### Supabase Edge Functions

```
weekly-checkin           CRON    Sunday 20:00 — Run Call 3 for all active users
seed-exercises           ONE-OFF Ingest free-exercise-db JSON into exercises table
```

---

## 7. Third-party integrations

### Anthropic API
- Model: `claude-sonnet-4-6`
- All calls use structured JSON output with Zod validation
- Retry logic: up to 2 retries on parse failure with a correction prompt appended
- API key stored in Vercel environment variable `ANTHROPIC_API_KEY`
- Never exposed client-side — all calls go through Next.js API routes

### Open Food Facts
- Endpoint: `https://world.openfoodfacts.org/api/v2/product/{barcode}.json`
- No auth required
- Parse: `product.nutriments` for `energy-kcal_100g`, `proteins_100g`, `carbohydrates_100g`, `fat_100g`, `fiber_100g`
- Fallback: if `status !== 1` or nutriments missing → try USDA

### USDA FoodData Central
- Endpoint: `https://api.nal.usda.gov/fdc/v1/foods/search?query={name}&api_key={key}`
- API key stored in `USDA_API_KEY` env var
- Used as secondary search and barcode fallback
- Rate limit: 3,600 requests/hour (free tier)

### free-exercise-db
- Source: `https://github.com/yuhonas/free-exercise-db`
- One-time seed via Edge Function or local script
- ~800 exercises with muscle group, equipment, instructions
- Stored in `exercises` table with `source = 'free-exercise-db'`

### Web Push API
- VAPID keys generated once, stored in env vars
- Push subscription stored in `push_subscriptions` per user
- Notifications sent from Edge Function `weekly-checkin`
- Client registers via `navigator.serviceWorker` + `PushManager.subscribe()`

---

## 8. Build phases

### Phase 1 — Foundation
**Goal:** Working app shell. Auth. Profile. Shared layout. Call 1.

- [ ] Next.js project scaffolded (App Router, TypeScript, Tailwind)
- [ ] Supabase project created, env vars wired to Vercel
- [ ] GitHub repo created, Vercel connected for auto-deploy
- [ ] Supabase Auth — email/password + Google OAuth
- [ ] `user_profiles` table + RLS
- [ ] Onboarding form (age, sex, height, weight, activity, goal, target rate)
- [ ] Call 1 API route `/api/ai/metrics` — computes and stores user_profile
- [ ] Protected route layout (sidebar nav, mobile bottom nav)
- [ ] User settings page (update profile, re-run Call 1)

**Done when:** A user can sign up, complete onboarding, and see their computed BMR/TDEE/targets.

---

### Phase 2 — Food tracker (core)
**Goal:** Manual food logging working end to end.

- [ ] `foods`, `food_entries`, `daily_nutrition_summaries` tables + RLS
- [ ] Food diary home screen (today's meals, macro ring progress)
- [ ] Add food — manual entry (name, calories, macros)
- [ ] Meal types (breakfast, lunch, dinner, snacks)
- [ ] Daily macro totals vs targets
- [ ] Edit/delete food entries
- [ ] Recent foods list

**Done when:** User can log a full day of food manually and see macro progress.

---

### Phase 3 — Barcode scanner
**Goal:** One-tap food logging via camera.

- [ ] Camera scanner component (`@zxing/library` or `html5-qrcode`)
- [ ] `/api/food/barcode` route — Open Food Facts → USDA fallback
- [ ] Auto-populate food entry from scan result
- [ ] Manual fallback if barcode not found (user fills in macros)
- [ ] "Save to my foods" from scan result

**Done when:** User can scan a barcode and log the food in under 5 seconds.

---

### Phase 4 — Fat loss tracker
**Goal:** Body weight logging and trend visualisation.

- [ ] `body_metrics` table + RLS
- [ ] Log weight screen (quick entry, optional note)
- [ ] Rolling 7-day average calculation
- [ ] Weight trend chart (recharts or Chart.js)
- [ ] Goal date projection line on chart
- [ ] Rate warning (too fast / too slow)
- [ ] Weekly delta card

**Done when:** User can log weight daily and see a meaningful trend chart.

---

### Phase 5 — Workout builder
**Goal:** Full program creation, session logging, exercise library.

- [ ] Exercise library seed (run `seed-exercises` Edge Function)
- [ ] `exercises`, `programs`, `program_weeks`, `sessions`, `exercise_sets`, `workout_logs` tables + RLS
- [ ] Exercise library browser (search, filter by muscle/equipment)
- [ ] Program builder UI (create program → add weeks → add sessions → add exercises)
- [ ] 10–15 seeded program templates (PPL, 5/3/1, GZCLP, nSuns, StrongLifts, PHUL, Arnold, etc.)
- [ ] Active session screen (exercise list, set logging, rest timer)
- [ ] Session completion — write `workout_logs`, estimate calories burned
- [ ] Session history and volume charts

**Done when:** User can run a seeded program, log sets, and see history.

---

### Phase 6 — AI food plan (Call 2A)
**Goal:** Generate personalised meal plan from user profile.

- [ ] Call 2A API route `/api/ai/food-plan`
- [ ] Zod schema for meal plan response
- [ ] Retry logic on parse failure
- [ ] Meal plan UI — view AI-generated daily template
- [ ] Training day vs rest day toggle
- [ ] "Use this plan" — seeds food diary template
- [ ] Regenerate plan button

**Done when:** User can request a meal plan and have it seed their food diary.

---

### Phase 7 — AI fitness plan (Call 2B)
**Goal:** Generate personalised training program from user profile.

- [ ] Call 2B API route `/api/ai/fitness-plan`
- [ ] Zod schema for fitness plan response
- [ ] Exercise name validation against library
- [ ] Plan generation UI (form: days/week, experience, equipment)
- [ ] Generated program appears in program list, ready to start
- [ ] Regenerate plan button

**Done when:** User can generate an AI program and start it immediately.

---

### Phase 8 — Unified dashboard
**Goal:** Single home screen that shows everything in one view.

- [ ] Net calories widget (eaten − burned)
- [ ] Macro ring (protein/carbs/fat vs targets)
- [ ] Today's workouts (next session card)
- [ ] Weight trend mini-chart
- [ ] Habit streak summary
- [ ] Weekly check-in card (shows last Call 3 output)

**Done when:** Dashboard is the natural first screen users open every day.

---

### Phase 9 — Habit tracker
**Goal:** Habit creation, check-ins, streaks.

- [ ] `habits`, `habit_logs` tables + RLS
- [ ] Habit list screen (today's habits, check-off)
- [ ] Add/edit habit form (name, frequency, category, reminder time)
- [ ] Streak calculation (current + longest)
- [ ] Weekly completion % chart
- [ ] Habit score calculation for Call 3

**Done when:** User can build a habit stack and see streaks.

---

### Phase 10 — Weekly AI check-in (Call 3)
**Goal:** Adaptive plan adjustment running automatically every week.

- [ ] `checkin_logs` table + RLS
- [ ] Weekly data aggregation query (Supabase RPC or Edge Function)
- [ ] `weekly-checkin` Edge Function with cron trigger
- [ ] Call 3 prompt + Zod validation
- [ ] User profile update on check-in output
- [ ] Check-in history view
- [ ] Push notification on Monday morning

**Done when:** After 2+ weeks of data, users receive a Monday adjustment card with an explanation.

---

### Phase 11 — PWA & notifications
**Goal:** App installs to home screen, works offline for logging, sends reminders.

- [ ] PWA manifest (`manifest.json`, icons at all sizes)
- [ ] Service worker (cache food diary and workout logging for offline)
- [ ] Install prompt UI
- [ ] VAPID key generation and env var setup
- [ ] `push_subscriptions` table
- [ ] `/api/push/subscribe` route
- [ ] Web Push from `weekly-checkin` Edge Function
- [ ] Habit reminder notifications (user-configurable time)

**Done when:** App installs on iOS/Android home screen and sends Monday check-in push.

---

### Phase 12 — Polish & QA
**Goal:** Production-ready. No data loss. Good mobile UX.

- [ ] Error boundaries on all AI call screens
- [ ] Loading states / skeletons everywhere
- [ ] Offline indicator + queued writes (food/workout logging)
- [ ] Input validation on all forms (client + server)
- [ ] Rate limit checks (USDA API, Anthropic API)
- [ ] Mobile UX pass (thumb-zone nav, swipe gestures where applicable)
- [ ] Lighthouse score ≥ 90 on mobile
- [ ] RLS audit — confirm no cross-user data leakage
- [ ] Env var audit — no secrets exposed client-side
- [ ] Custom domain wired in Vercel

---

## 9. Requirements checklist

### Functional requirements

#### Auth & profile
- [ ] User can sign up with email/password
- [ ] User can sign up / log in with Google OAuth
- [ ] User can complete onboarding and have targets computed
- [ ] User can update their profile and re-generate targets
- [ ] User can delete their account and all data

#### Food tracker
- [ ] Log food by barcode scan
- [ ] Log food by name search
- [ ] Log food by manual entry
- [ ] Edit serving size on any logged food
- [ ] Delete a food entry
- [ ] View daily macro totals vs targets
- [ ] View net calories (eaten − workout burn)
- [ ] See AI-generated meal plan as a template
- [ ] Create and save custom foods
- [ ] View weekly food summary

#### Workout
- [ ] Browse exercise library
- [ ] Build a custom program
- [ ] Start an AI-generated program
- [ ] Start a seeded template program
- [ ] Log sets, reps, weight during a session
- [ ] Complete a session (writes to history)
- [ ] View session history
- [ ] View volume over time per exercise

#### Fat loss
- [ ] Log weight daily
- [ ] Log body measurements (optional)
- [ ] View 7-day rolling average
- [ ] View trend chart vs goal projection
- [ ] Receive rate alert if losing too fast or too slow

#### Habits
- [ ] Create a habit with custom frequency and reminder
- [ ] Check off habits daily
- [ ] View current and longest streak
- [ ] View weekly completion %

#### AI
- [ ] Receive computed BMR/TDEE/targets on onboarding
- [ ] Request an AI food plan
- [ ] Request an AI fitness program
- [ ] Receive weekly adaptive check-in card
- [ ] See plain-English explanation of any plan adjustment

### Non-functional requirements
- [ ] All user data isolated via Supabase RLS — no cross-user reads
- [ ] No Anthropic API key exposed client-side
- [ ] AI call responses validated with Zod before any DB write
- [ ] Daily calorie target never set below user's BMR
- [ ] Barcode scan fallback to manual if no match found
- [ ] App loads in <3s on a 4G mobile connection
- [ ] Food diary and workout logging work offline (service worker)
- [ ] All forms have client-side and server-side validation

---

## 10. Open questions & decisions

| # | Question | Status | Decision |
|---|---|---|---|
| 1 | Call 1 — pure math vs AI? | Open | Leaning pure math (deterministic, free). AI only if we want natural-language goal framing |
| 2 | Barcode scanner library — `@zxing/library` vs `html5-qrcode`? | Open | `@zxing/library` more actively maintained; test both |
| 3 | Charts library — Recharts vs Chart.js vs Tremor? | Open | Recharts likely (React-native, good SSR support) |
| 4 | Carb cycling — hard default or user opt-in? | Open | Recommend default on, user can disable in settings |
| 5 | PWA vs React Native — future mobile? | Open | PWA first; RN only if PWA has blockers (camera, push) on iOS |
| 6 | Program seeding — manual JSON vs admin UI? | Open | Start with JSON seed file in `/scripts/seed-programs.ts` |
| 7 | Weekly check-in time zone handling? | Open | Store user TZ on signup, cron uses it for scheduling |
| 8 | Multiple active programs simultaneously? | Open | One active program per goal type (cut + strength can co-exist) |
| 9 | Social / community features (shared programs)? | Deferred | Phase 2 feature, not MVP |
| 10 | Calorie burn from non-gym activity (steps)? | Open | Could integrate with Health API (iOS) or Google Fit later |

---

*This document should be committed to the repo root as `BUILD_LOG.md` and updated at the close of each phase.*
