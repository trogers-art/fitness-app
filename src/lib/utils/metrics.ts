import type { OnboardingFormData, UserProfile } from '@/lib/types'

const ACTIVITY_MULTIPLIERS = {
  sedentary:    1.2,
  light:        1.375,
  moderate:     1.55,
  active:       1.725,
  very_active:  1.9,
} as const

// Mifflin-St Jeor equation
function computeBMR(weightKg: number, heightCm: number, age: number, sex: 'male' | 'female'): number {
  const base = (10 * weightKg) + (6.25 * heightCm) - (5 * age)
  return sex === 'male' ? base + 5 : base - 161
}

function computeTDEE(bmr: number, activityLevel: OnboardingFormData['activity_level']): number {
  return bmr * ACTIVITY_MULTIPLIERS[activityLevel]
}

function computeMacros(
  dailyCalories: number,
  weightKg: number,
  goal: OnboardingFormData['goal']
) {
  // Protein: 1.8g/kg for fat loss, 2.0g/kg for muscle gain, 1.6g/kg for maintain
  const proteinMultiplier = goal === 'fat_loss' ? 1.8 : goal === 'muscle_gain' ? 2.0 : 1.6
  const proteinG = Math.max(120, Math.round(weightKg * proteinMultiplier))

  // Fat: 25% of calories
  const fatG = Math.round((dailyCalories * 0.25) / 9)

  // Carbs: remainder
  const proteinCals = proteinG * 4
  const fatCals = fatG * 9
  const carbsG = Math.max(50, Math.round((dailyCalories - proteinCals - fatCals) / 4))

  return { proteinG, fatG, carbsG }
}

export function computeMetrics(data: OnboardingFormData & { units?: string }): Omit<
  UserProfile,
  'id' | 'user_id' | 'created_at' | 'updated_at' | 'timezone'
> & { timezone: string } {
  const bmr = Math.round(computeBMR(data.weight_kg, data.height_cm, data.age, data.sex))
  const tdee = Math.round(computeTDEE(bmr, data.activity_level))

  // 1kg fat ≈ 7,700 kcal; weekly target → daily deficit
  const dailyDeficit = Math.round((data.target_rate_kg_per_week * 7700) / 7)

  let rawCalories: number
  if (data.goal === 'fat_loss') {
    rawCalories = tdee - dailyDeficit
  } else if (data.goal === 'muscle_gain') {
    rawCalories = tdee + 250   // modest lean bulk surplus
  } else {
    rawCalories = tdee
  }

  // Hard floors and ceilings
  const maxDeficit = 1000
  const minCalories = bmr   // never below basal
  const dailyCalories = Math.max(minCalories, Math.min(tdee + 500, rawCalories))

  // Clamp deficit
  if (data.goal === 'fat_loss' && (tdee - dailyCalories) > maxDeficit) {
    // Silently cap — API route will surface this to user
  }

  const { proteinG, fatG, carbsG } = computeMacros(dailyCalories, data.weight_kg, data.goal)

  // Carb cycling: rest days get 20% fewer carbs, training days get 20% more
  const trainingDayCarbsG = Math.round(carbsG * 1.2)
  const restDayCarbsG = Math.round(carbsG * 0.8)

  return {
    age: data.age,
    sex: data.sex,
    height_cm: data.height_cm,
    weight_kg: data.weight_kg,
    activity_level: data.activity_level,
    timezone: data.timezone,
    goal: data.goal,
    target_rate_kg_per_week: data.target_rate_kg_per_week,
    bmr,
    tdee,
    daily_calories: dailyCalories,
    protein_g: proteinG,
    carbs_g: carbsG,
    fat_g: fatG,
    training_day_carbs_g: trainingDayCarbsG,
    rest_day_carbs_g: restDayCarbsG,
    units: data.units || 'imperial',
  }
}

// Epley 1RM formula
export function computeOneRM(weightKg: number, reps: number): number {
  if (reps === 1) return weightKg
  return Math.round(weightKg * (1 + reps / 30))
}

// Estimated calorie burn (MET-based, simplified)
export function estimateCaloriesBurned(
  durationMinutes: number,
  weightKg: number,
  intensity: 'low' | 'moderate' | 'high' = 'moderate'
): number {
  const MET = intensity === 'low' ? 3.5 : intensity === 'moderate' ? 5.0 : 7.0
  return Math.round((MET * weightKg * durationMinutes) / 60)
}

// Rolling 7-day average for weight trend
export function computeRollingAverage(weights: { date: string; weight_kg: number }[], days = 7): number | null {
  if (weights.length === 0) return null
  const recent = weights.slice(-days)
  return Math.round((recent.reduce((sum, w) => sum + w.weight_kg, 0) / recent.length) * 10) / 10
}

// Goal date projection
export function projectGoalDate(
  currentWeight: number,
  targetWeight: number,
  rateKgPerWeek: number
): Date | null {
  if (rateKgPerWeek <= 0) return null
  const kgToLose = currentWeight - targetWeight
  if (kgToLose <= 0) return null
  const weeksNeeded = kgToLose / rateKgPerWeek
  const date = new Date()
  date.setDate(date.getDate() + Math.round(weeksNeeded * 7))
  return date
}
