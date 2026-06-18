import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const SetSchema = z.object({
  exercise_id:         z.string().uuid(),
  exercise_name:       z.string(),
  set_number:          z.number().int().min(1),
  weight_kg:           z.number().min(0).optional(),
  reps:                z.number().int().min(0).optional(),
  completed:           z.boolean().default(true),
  logged_at:           z.string().optional(),
  rest_target_seconds: z.number().int().min(0).optional(),
  rest_actual_seconds: z.number().int().min(0).nullable().optional(),
})

const LogSchema = z.object({
  program_id:       z.string().uuid().optional(),
  session_id:       z.string().uuid().optional(),
  name:             z.string().min(1),
  started_at:       z.string(),
  finished_at:      z.string(),
  duration_seconds: z.number().int().min(0),
  notes:            z.string().optional(),
  sets:             z.array(SetSchema),
})

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: logs, error } = await supabase
    .from('workout_logs')
    .select(`
      id, name, started_at, completed_at, duration_seconds, duration_minutes, program_id, session_id, notes, calories_burned_est,
      workout_log_sets ( id, exercise_name, set_number, weight_kg, reps, completed, logged_at )
    `)
    .eq('user_id', user.id)
    .order('started_at', { ascending: false, nullsFirst: false })
    .limit(20)

  if (error) {
    console.error('[workout-logs] GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ logs: logs || [] })
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = LogSchema.safeParse(body)
  if (!parsed.success) {
    console.error('[workout-logs] validation error:', parsed.error.flatten())
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { sets, program_id, session_id, name, started_at, finished_at, duration_seconds, notes } = parsed.data

  // ── Estimate calories burned using METs + actual training volume ─────────
  // Base: calories = METs × weight(kg) × duration(hours)
  // METs tier is driven by volume density (kg moved per minute) AND actual rest
  // taken between sets — shorter real rest = higher work density = higher METs,
  // even if two sessions have similar total duration.
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('weight_kg')
    .eq('user_id', user.id)
    .single()

  const bodyWeightKg  = profile?.weight_kg || 80
  const durationHours = duration_seconds / 3600
  const durationMin   = duration_seconds / 60

  const completedSets = sets.filter(s => s.completed)

  // Total volume = sum of (weight_kg × reps) across all completed sets.
  // Bodyweight-only sets use bodyweight as the effective load.
  const totalVolumeKg = completedSets.reduce((sum, s) => {
    const load = s.weight_kg && s.weight_kg > 0 ? s.weight_kg : bodyWeightKg
    const reps = s.reps || 0
    return sum + (load * reps)
  }, 0)

  const volumePerMinute = durationMin > 0 ? totalVolumeKg / durationMin : 0

  // Average actual rest taken between sets (excludes first set of session, which has no prior rest)
  const restSamples = completedSets
    .map(s => s.rest_actual_seconds)
    .filter((r): r is number => r !== null && r !== undefined)

  const avgActualRest = restSamples.length > 0
    ? restSamples.reduce((a, b) => a + b, 0) / restSamples.length
    : null

  // Average target rest, for comparison
  const targetRests = completedSets
    .map(s => s.rest_target_seconds)
    .filter((r): r is number => r !== undefined)
  const avgTargetRest = targetRests.length > 0
    ? targetRests.reduce((a, b) => a + b, 0) / targetRests.length
    : null

  // Rest compliance ratio — below 1.0 means resting less than prescribed (higher density)
  const restRatio = (avgActualRest !== null && avgTargetRest && avgTargetRest > 0)
    ? avgActualRest / avgTargetRest
    : 1.0

  // METs tiers from volume density, then nudged up if actual rest ran shorter than prescribed
  let mets = 3.5
  if (volumePerMinute >= 250)      mets = 6.0
  else if (volumePerMinute >= 120) mets = 5.0
  else if (volumePerMinute >= 50)  mets = 4.0

  // Resting noticeably less than prescribed bumps intensity up to the next half-tier,
  // capped at 6.5 (vigorous resistance training ceiling per ACSM)
  if (restRatio < 0.7) mets = Math.min(mets + 0.5, 6.5)

  const caloriesBurned = durationHours > 0
    ? Math.round(mets * bodyWeightKg * durationHours)
    : 0

  const { data: log, error } = await supabase
    .from('workout_logs')
    .insert({
      user_id:             user.id,
      session_id:          session_id || null,
      program_id:          program_id || null,
      name,
      started_at,
      completed_at:        finished_at,
      duration_seconds,
      duration_minutes:    Math.round(duration_seconds / 60),
      notes:               notes || null,
      calories_burned_est: caloriesBurned,
    })
    .select('id').single()

  if (error || !log) {
    console.error('[workout-logs] insert error:', error)
    return NextResponse.json({ error: error?.message || 'Failed to save log' }, { status: 500 })
  }

  if (sets.length > 0) {
    const { error: setsError } = await supabase.from('workout_log_sets').insert(
      sets.map(s => ({
        workout_log_id: log.id,
        exercise_id:    s.exercise_id,
        exercise_name:  s.exercise_name,
        set_number:     s.set_number,
        weight_kg:      s.weight_kg ?? null,
        reps:           s.reps ?? null,
        completed:      s.completed,
        logged_at:      s.logged_at || new Date().toISOString(),
      }))
    )
    if (setsError) {
      console.error('[workout-logs] sets insert error:', setsError)
      return NextResponse.json({ error: 'Log saved but sets failed: ' + setsError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ log_id: log.id, calories_burned_est: caloriesBurned })
}
