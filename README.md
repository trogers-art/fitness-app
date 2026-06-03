# FitApp

Personalised fitness & nutrition platform. Four modules: Habit Tracker, Workout Builder, Fat Loss Tracker, Food Tracker with barcode scanning. AI-generated food and fitness plans that adapt weekly.

## Stack

- **Next.js 14** (App Router, TypeScript)
- **Supabase** (Postgres, Auth, Storage, Edge Functions)
- **Vercel** (hosting, CI/CD)
- **Anthropic API** (claude-sonnet-4-6 for AI plans)
- **Recharts** (data visualisation)
- **Tailwind CSS**

## Setup

### 1. Clone and install

```bash
git clone <your-repo>
cd fitapp
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Run the migration: copy `supabase/migrations/001_initial_schema.sql` into the SQL editor and execute
3. Enable Google OAuth in Authentication → Providers

### 3. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=         # Project URL from Supabase dashboard
NEXT_PUBLIC_SUPABASE_ANON_KEY=    # Anon key from API settings
SUPABASE_SERVICE_ROLE_KEY=        # Service role key (never expose client-side)
ANTHROPIC_API_KEY=                # From console.anthropic.com
USDA_API_KEY=                     # From api.nal.usda.gov/fdc (free)
```

### 4. Seed exercise library

```bash
npm run db:seed-exercises
```

This pulls ~800 exercises from [free-exercise-db](https://github.com/yuhonas/free-exercise-db) and inserts them into Supabase.

### 5. Deploy Edge Function

```bash
supabase functions deploy weekly-checkin
```

### 6. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 7. Deploy to Vercel

Connect the GitHub repo to Vercel. Add all environment variables from `.env.local` in the Vercel dashboard. Vercel auto-deploys on every push to `main`.

## Build phases

See `BUILD_LOG.md` for the full phased build plan and requirements checklist.

| Phase | Module | Status |
|---|---|---|
| 1 | Foundation — auth, profile, Call 1 | ✅ Complete |
| 2 | Food tracker (manual logging) | 🔜 Next |
| 3 | Barcode scanner | 🔜 |
| 4 | Fat loss tracker | 🔜 |
| 5 | Workout builder + exercise library | 🔜 |
| 6 | AI food plan (Call 2A) | 🔜 |
| 7 | AI fitness plan (Call 2B) | 🔜 |
| 8 | Unified dashboard | 🔜 |
| 9 | Habit tracker | 🔜 |
| 10 | Weekly check-in (Call 3) | 🔜 |
| 11 | PWA + push notifications | 🔜 |
| 12 | Polish & QA | 🔜 |

## Project structure

```
src/
  app/
    (auth)/           # Login, signup, onboarding
    (app)/            # Protected routes — dashboard, food, workouts, body, habits
    api/              # API routes — AI calls, barcode, search, user profile
  components/
    layout/           # AppNav, shell
    exercise/         # ExerciseLibrary, ExerciseCard, ExercisePickerModal
    food/             # FoodDiary, MacroRing, BarcodeScanner
    workout/          # ProgramBuilder, ActiveSession, SetRow
    body/             # WeightChart, MetricsForm
    habits/           # HabitList, StreakBadge
    shared/           # Shared UI primitives
  lib/
    supabase/         # Server + browser clients, middleware
    utils/            # metrics.ts (Call 1 math), helpers
    hooks/            # useExercises, useRestTimer, useOneRM
    types/            # All TypeScript interfaces
    validators/       # Zod schemas for forms and AI responses
supabase/
  migrations/         # 001_initial_schema.sql
  functions/
    weekly-checkin/   # Call 3 — Sunday cron, adaptive plan adjustment
    seed-exercises/   # One-time exercise library seed
scripts/
  seed-exercises.ts   # Local seed script
  seed-programs.ts    # Manual program templates seed
```
