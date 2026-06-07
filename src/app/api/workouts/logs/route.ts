import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const SetSchema = z.object({
  exercise_id:   z.string().uuid(),
  exercise_name: z.string(),
  set_number:    z.number().int().min(1),
  weight_kg:     z.number().min(0).optional(),
  reps:          z.number().int().min(0).optional(),
  completed:     z.boolean().default(true),
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

  const { data: logs } = await supabase
    .from('workout_logs')
    .select(`
      id, name, started_at, finished_at, duration_seconds, program_id, session_id,
      workout_log_sets ( id, exercise_name, set_number, weight_kg, reps, completed )
    `)
    .eq('user_id', user.id)
    .order('started_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ logs: logs || [] })
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = LogSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })

  const { sets, ...logData } = parsed.data

  const { data: log, error } = await supabase
    .from('workout_logs')
    .insert({ user_id: user.id, ...logData })
    .select('id').single()

  if (error || !log) return NextResponse.json({ error: 'Failed to save log' }, { status: 500 })

  if (sets.length > 0) {
    await supabase.from('workout_log_sets').insert(
      sets.map(s => ({ workout_log_id: log.id, ...s }))
    )
  }

  return NextResponse.json({ log_id: log.id })
}
