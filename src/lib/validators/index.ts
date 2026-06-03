import { z } from 'zod'

// ─── Onboarding ────────────────────────────────────────────────────────────

export const OnboardingSchema = z.object({
  age: z.number().int().min(13).max(100),
  sex: z.enum(['male', 'female']),
  height_cm: z.number().min(100).max(250),
  weight_kg: z.number().min(30).max(300),
  activity_level: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']),
  goal: z.enum(['fat_loss', 'muscle_gain', 'maintain']),
  target_rate_kg_per_week: z.number().min(0.1).max(1.0),
  timezone: z.string().min(1),
})

// ─── Food ──────────────────────────────────────────────────────────────────

export const FoodEntrySchema = z.object({
  food_id: z.string().uuid(),
  meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'post_workout']),
  quantity_g: z.number().min(1).max(5000),
  logged_at: z.string().datetime().optional(),
})

export const CustomFoodSchema = z.object({
  name: z.string().min(1).max(200),
  brand: z.string().max(100).optional(),
  barcode: z.string().max(50).optional(),
  calories_per_100g: z.number().min(0).max(1000),
  protein_per_100g: z.number().min(0).max(100),
  carbs_per_100g: z.number().min(0).max(100),
  fat_per_100g: z.number().min(0).max(100),
  fibre_per_100g: z.number().min(0).max(100).optional(),
})

// ─── Body metrics ──────────────────────────────────────────────────────────

export const BodyMetricSchema = z.object({
  weight_kg: z.number().min(20).max(300),
  body_fat_pct: z.number().min(3).max(60).optional(),
  waist_cm: z.number().min(40).max(250).optional(),
  hips_cm: z.number().min(40).max(250).optional(),
  chest_cm: z.number().min(40).max(250).optional(),
  arms_cm: z.number().min(10).max(100).optional(),
  thighs_cm: z.number().min(20).max(150).optional(),
  note: z.string().max(500).optional(),
  logged_at: z.string().datetime().optional(),
})

// ─── Habits ────────────────────────────────────────────────────────────────

export const HabitSchema = z.object({
  name: z.string().min(1).max(100),
  frequency: z.enum(['daily', 'weekly']),
  category: z.enum(['sleep', 'hydration', 'nutrition', 'movement', 'mindset', 'other']),
  reminder_time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
})

// ─── Exercises ─────────────────────────────────────────────────────────────

export const CustomExerciseSchema = z.object({
  name: z.string().min(1).max(200),
  muscle_group: z.enum([
    'chest', 'back', 'shoulders', 'biceps', 'triceps',
    'forearms', 'core', 'quads', 'hamstrings', 'glutes',
    'calves', 'full_body', 'cardio',
  ]),
  secondary_muscles: z.array(z.string()).optional(),
  equipment: z.array(z.string()).min(1),
  type: z.enum(['compound', 'isolation', 'cardio', 'mobility']),
  instructions: z.array(z.string()).optional(),
})

// ─── AI response schemas ───────────────────────────────────────────────────

const MealTemplateSchema = z.object({
  meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'post_workout']),
  name: z.string(),
  target_calories: z.number().min(50).max(1500),
  target_protein_g: z.number().min(0).max(200),
  target_carbs_g: z.number().min(0).max(400),
  target_fat_g: z.number().min(0).max(150),
  suggested_foods: z.array(z.string()).min(1),
})

export const MealPlanResponseSchema = z.object({
  daily_targets: z.object({
    calories: z.number().min(800).max(8000),
    protein_g: z.number().min(50).max(500),
    carbs_g: z.number().min(0).max(800),
    fat_g: z.number().min(20).max(300),
    fibre_g: z.number().min(15).max(100),
  }),
  training_day_meals: z.array(MealTemplateSchema).min(3),
  rest_day_meals: z.array(MealTemplateSchema).min(3),
  notes: z.string(),
})

const SessionExerciseSchema = z.object({
  exercise_name: z.string(),
  order_index: z.number().int().min(0),
  target_sets: z.number().int().min(1).max(10),
  target_reps: z.string(),      // "8-12" or "5"
  target_weight_note: z.string().optional(),
  rest_seconds: z.number().int().min(30).max(600),
})

const SessionSchema = z.object({
  day_of_week: z.number().int().min(1).max(7),
  focus: z.string(),
  exercises: z.array(SessionExerciseSchema).min(1),
})

const ProgramWeekSchema = z.object({
  week_number: z.number().int().min(1),
  is_deload: z.boolean(),
  sessions: z.array(SessionSchema).min(1),
})

export const FitnessPlanResponseSchema = z.object({
  program_name: z.string().min(1),
  goal: z.enum(['fat_loss', 'muscle_gain', 'maintain']),
  weeks: z.array(ProgramWeekSchema).min(1).max(16),
  progression_notes: z.string(),
})

export const CheckinResponseSchema = z.object({
  new_daily_calories: z.number().min(800).max(8000),
  calorie_adjustment: z.number().min(-500).max(500),
  program_load: z.enum(['maintain', 'progress', 'deload']),
  explanation: z.string().min(20),
})

export type OnboardingInput = z.infer<typeof OnboardingSchema>
export type MealPlanResponse = z.infer<typeof MealPlanResponseSchema>
export type FitnessPlanResponse = z.infer<typeof FitnessPlanResponseSchema>
export type CheckinResponse = z.infer<typeof CheckinResponseSchema>
