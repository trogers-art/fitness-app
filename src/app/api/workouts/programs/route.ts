import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const SessionExerciseSchema = z.object({
  exercise_id:     z.string().uuid(),
  order_index:     z.number().int().min(0),
  target_sets:     z.number().int().min(1).max(20),
  target_reps:     z.string().min(1),
  target_weight_kg: z.number().optional(),
  rest_seconds:    z.number().int().min(30).max(600).default(90),
})

const SessionSchema = z.object({
  day_of_week: z.number().int().min(1).max(7),
  focus:       z.string().min(1),
  exercises:   z.array(SessionExerciseSchema),
})

const ProgramSchema = z.object({
  name:          z.string().min(1).max(100),
  goal:          z.enum(['fat_loss','muscle_gain','maintain']),
  duration_weeks: z.number().int().min(1).max(52).default(8),
  days_per_week: z.number().int().min(1).max(7),
  sessions:      z.array(SessionSchema).min(1),
})

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: programs } = await supabase
    .from('programs')
    .select(`
      id, name, goal, duration_weeks, days_per_week, active, ai_generated, created_at,
      program_weeks (
        id, week_number,
        sessions (
          id, day_of_week, focus,
          session_exercises (
            id, order_index, target_sets, target_reps, target_weight_kg, rest_seconds,
            exercise:exercises ( id, name, muscle_group, equipment, gif_url )
          )
        )
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ programs: programs || [] })
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = ProgramSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })

  const { name, goal, duration_weeks, days_per_week, sessions } = parsed.data

  // 1. Create program
  const { data: program, error: progErr } = await supabase
    .from('programs')
    .insert({ user_id: user.id, name, goal, duration_weeks, days_per_week, ai_generated: false })
    .select('id').single()
  if (progErr || !program) return NextResponse.json({ error: 'Failed to create program' }, { status: 500 })

  // 2. Create week 1 (manual programs start with one repeating week)
  const { data: week, error: weekErr } = await supabase
    .from('program_weeks')
    .insert({ program_id: program.id, week_number: 1, is_deload: false })
    .select('id').single()
  if (weekErr || !week) return NextResponse.json({ error: 'Failed to create week' }, { status: 500 })

  // 3. Create sessions + exercises
  for (const session of sessions) {
    const { data: sess, error: sessErr } = await supabase
      .from('sessions')
      .insert({ program_week_id: week.id, user_id: user.id, day_of_week: session.day_of_week, focus: session.focus })
      .select('id').single()
    if (sessErr || !sess) continue

    if (session.exercises.length > 0) {
      await supabase.from('session_exercises').insert(
        session.exercises.map(ex => ({ session_id: sess.id, ...ex }))
      )
    }
  }

  return NextResponse.json({ program_id: program.id })
}
