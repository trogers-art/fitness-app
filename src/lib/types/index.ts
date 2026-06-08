// ─── User & Profile ────────────────────────────────────────────────────────

export type Goal = 'fat_loss' | 'muscle_gain' | 'maintain'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
export type Sex = 'male' | 'female'

export interface UserProfile {
  id: string
  user_id: string
  // biometrics
  age: number
  sex: Sex
  height_cm: number
  weight_kg: number
  activity_level: ActivityLevel
  timezone: string
  // goal
  goal: Goal
  target_rate_kg_per_week: number
  // computed (Call 1)
  bmr: number
  tdee: number
  daily_calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  // training day adjustments
  training_day_carbs_g: number
  rest_day_carbs_g: number
  // preferences
  units: 'imperial' | 'metric'
  theme: 'default' | 'dark' | 'light'
  target_weight_kg: number | null
  // meta
  created_at: string
  updated_at: string
}

export interface OnboardingFormData {
  age: number
  sex: Sex
  height_cm: number
  weight_kg: number
  activity_level: ActivityLevel
  goal: Goal
  target_rate_kg_per_week: number
  timezone: string
}

// ─── Habits ────────────────────────────────────────────────────────────────

export type HabitFrequency = 'daily' | 'weekly'
export type HabitCategory = 'sleep' | 'hydration' | 'nutrition' | 'movement' | 'mindset' | 'other'

export interface Habit {
  id: string
  user_id: string
  name: string
  frequency: HabitFrequency
  category: HabitCategory
  reminder_time: string | null   // HH:MM
  active: boolean
  created_at: string
}

export interface HabitLog {
  id: string
  habit_id: string
  user_id: string
  completed_at: string
  note: string | null
}

export interface HabitWithStreak extends Habit {
  current_streak: number
  longest_streak: number
  completed_today: boolean
}

// ─── Food ──────────────────────────────────────────────────────────────────

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'pre_workout' | 'post_workout'
export type FoodSource = 'openfoodfacts' | 'usda' | 'custom'

export interface Food {
  id: string
  barcode: string | null
  name: string
  brand: string | null
  calories_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
  fibre_per_100g: number | null
  sugar_per_100g: number | null
  sodium_per_100g: number | null
  source: FoodSource
  user_id: string | null   // null = global food
  created_at: string
}

export interface FoodEntry {
  id: string
  user_id: string
  food_id: string
  food: Food
  meal_type: MealType
  quantity_g: number
  logged_at: string
  is_training_day: boolean
  // computed
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export interface DailyNutritionSummary {
  id: string
  user_id: string
  date: string           // YYYY-MM-DD
  total_calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fibre_g: number
  workout_calories_burned: number
  net_calories: number
  is_training_day: boolean
}

export interface MealPlan {
  id: string
  user_id: string
  ai_generated: boolean
  daily_targets: {
    calories: number
    protein_g: number
    carbs_g: number
    fat_g: number
    fibre_g: number
  }
  training_day_meals: MealTemplate[]
  rest_day_meals: MealTemplate[]
  notes: string
  created_at: string
}

export interface MealTemplate {
  meal_type: MealType
  name: string
  target_calories: number
  target_protein_g: number
  target_carbs_g: number
  target_fat_g: number
  suggested_foods: string[]
}

// ─── Exercises & Workouts ──────────────────────────────────────────────────

export type EquipmentType =
  | 'barbell' | 'dumbbell' | 'kettlebell' | 'cable'
  | 'machine' | 'bodyweight' | 'resistance_band'
  | 'pull_up_bar' | 'bench' | 'other'

export type MuscleGroup =
  | 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps'
  | 'forearms' | 'core' | 'quads' | 'hamstrings' | 'glutes'
  | 'calves' | 'full_body' | 'cardio'

export type ExerciseType = 'compound' | 'isolation' | 'cardio' | 'mobility'

export interface Exercise {
  id: string
  name: string
  muscle_group: MuscleGroup
  secondary_muscles: MuscleGroup[]
  equipment: EquipmentType[]
  type: ExerciseType
  instructions: string[]
  gif_url: string | null
  source: string
  user_id: string | null   // null = global
  created_at: string
}

export interface Program {
  id: string
  user_id: string
  name: string
  goal: Goal
  duration_weeks: number
  days_per_week: number
  ai_generated: boolean
  template: boolean
  active: boolean
  started_at: string | null
  completed_at: string | null
  created_at: string
  weeks?: ProgramWeek[]
}

export interface ProgramWeek {
  id: string
  program_id: string
  week_number: number
  is_deload: boolean
  sessions?: Session[]
}

export interface Session {
  id: string
  program_week_id: string
  user_id: string
  day_of_week: number   // 1=Mon … 7=Sun
  focus: string         // e.g. "Push", "Legs A"
  planned: boolean
  performed_at: string | null
  exercises?: SessionExercise[]
}

export interface SessionExercise {
  id: string
  session_id: string
  exercise_id: string
  exercise: Exercise
  order_index: number
  target_sets: number
  target_reps: string    // e.g. "8-12" or "5"
  target_weight_kg: number | null
  rest_seconds: number
  sets?: ExerciseSet[]
}

export interface ExerciseSet {
  id: string
  session_exercise_id: string
  set_number: number
  reps: number
  weight_kg: number
  rpe: number | null   // Rate of Perceived Exertion 1-10
  completed: boolean
  completed_at: string | null
}

export interface WorkoutLog {
  id: string
  session_id: string
  user_id: string
  duration_minutes: number
  calories_burned_est: number
  notes: string | null
  completed_at: string
}

// ─── Body Metrics ──────────────────────────────────────────────────────────

export interface BodyMetric {
  id: string
  user_id: string
  logged_at: string
  weight_kg: number
  body_fat_pct: number | null
  waist_cm: number | null
  hips_cm: number | null
  chest_cm: number | null
  arms_cm: number | null
  thighs_cm: number | null
  note: string | null
}

// ─── AI Plans ──────────────────────────────────────────────────────────────

export type AIPlanType = 'food' | 'fitness' | 'checkin'

export interface AIPlan {
  id: string
  user_id: string
  type: AIPlanType
  response_json: Record<string, unknown>
  created_at: string
}

export interface CheckinLog {
  id: string
  user_id: string
  week_start: string
  inputs: CheckinInputs
  outputs: CheckinOutputs
  explanation: string
  created_at: string
}

export interface CheckinInputs {
  avg_calories_eaten: number
  target_calories: number
  workouts_completed: number
  workouts_planned: number
  weight_start_of_week: number
  weight_end_of_week: number
  target_weekly_loss: number
  habit_completion_pct: number
}

export interface CheckinOutputs {
  new_daily_calories: number
  calorie_adjustment: number
  program_load: 'maintain' | 'progress' | 'deload'
  explanation: string
}

// ─── UI helpers ────────────────────────────────────────────────────────────

export interface MacroRing {
  calories: { eaten: number; target: number }
  protein: { eaten: number; target: number }
  carbs: { eaten: number; target: number }
  fat: { eaten: number; target: number }
}

export interface ExerciseFilters {
  query: string
  muscle_group: MuscleGroup | 'all'
  equipment: EquipmentType | 'all'
  type: ExerciseType | 'all'
}

export type ExercisePickerMode = 'browse' | 'pick-multi' | 'pick-single'
