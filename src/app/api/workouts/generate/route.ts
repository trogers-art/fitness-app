import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'

const GenerateSchema = z.object({
  days_per_week:   z.number().int().min(1).max(7),
  duration_weeks:  z.number().int().min(1).max(16).default(8),
  experience:      z.enum(['beginner','intermediate','advanced']),
  equipment:       z.array(z.string()).min(1),
  injuries:        z.string().optional(),
})

export async function POST(request: NextRequest) {
  const supabase   = createClient()
  const anthropic  = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await request.json()
  const parsed = GenerateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { days_per_week, duration_weeks, experience, equipment, injuries } = parsed.data

  // Fetch user profile
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('goal, weight_kg, age, sex, activity_level, daily_calories, protein_g')
    .eq('user_id', user.id).single()

  // Fetch available exercises from seeded library
  const { data: exercises } = await supabase
    .from('exercises')
    .select('name, muscle_group, equipment, type')
    .is('user_id', null)
    .in('equipment', equipment.map(e => `{${e}}`))
    .order('name')
    .limit(200)

  // Build exercise list string grouped by muscle
  const byMuscle: Record<string, string[]> = {}
  for (const ex of exercises || []) {
    if (!byMuscle[ex.muscle_group]) byMuscle[ex.muscle_group] = []
    byMuscle[ex.muscle_group].push(`${ex.name} (${ex.type})`)
  }
  const exerciseList = Object.entries(byMuscle)
    .map(([m, exs]) => `${m.toUpperCase()}: ${exs.slice(0, 12).join(', ')}`)
    .join('\n')

  const DAY_NAMES = ['','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']

  const prompt = `You are an expert strength and conditioning coach. Generate a ${duration_weeks}-week training program.

USER PROFILE:
- Goal: ${profile?.goal?.replace('_',' ') ?? 'muscle gain'}
- Experience: ${experience}
- Days per week: ${days_per_week}
- Equipment available: ${equipment.join(', ')}
- Body weight: ${profile?.weight_kg ? Math.round(profile.weight_kg * 2.20462) + ' lbs' : 'unknown'}
- Daily calories: ${profile?.daily_calories ?? 'unknown'}
${injuries ? `- Injuries/limitations: ${injuries}` : ''}

AVAILABLE EXERCISES (use ONLY these, exact names):
${exerciseList}

Generate a program with exactly ${days_per_week} training sessions per week.
Assign sessions to specific days of the week (1=Monday through 7=Sunday).

Respond with ONLY valid JSON, no markdown, no explanation:
{
  "program_name": "string",
  "sessions": [
    {
      "day_of_week": 1,
      "focus": "string (e.g. Push, Pull, Legs, Upper, Lower, Full Body)",
      "exercises": [
        {
          "exercise_name": "exact name from list above",
          "target_sets": 3,
          "target_reps": "8-12",
          "rest_seconds": 90,
          "order_index": 0
        }
      ]
    }
  ],
  "training_day_notes": "brief note on training day nutrition/timing",
  "rest_day_notes": "brief note on rest day approach"
}`

  try {
    const message = await anthropic.messages.create({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages:   [{ role: 'user', content: prompt }],
    })

    const text  = message.content.find(b => b.type === 'text')?.text ?? ''
    const clean = text.replace(/```json|```/g, '').trim()
    const plan  = JSON.parse(clean)

    // Match exercise names to IDs from DB
    const { data: allExercises } = await supabase
      .from('exercises')
      .select('id, name')
      .is('user_id', null)

    const nameToId: Record<string, string> = {}
    for (const ex of allExercises || []) {
      nameToId[ex.name.toLowerCase()] = ex.id
    }

    // Build sessions with exercise IDs
    const sessions = plan.sessions.map((s: any) => ({
      day_of_week: s.day_of_week,
      focus:       s.focus,
      exercises:   s.exercises
        .map((ex: any, i: number) => {
          const id = nameToId[ex.exercise_name?.toLowerCase()]
          if (!id) return null
          return {
            exercise_id:  id,
            order_index:  i,
            target_sets:  ex.target_sets || 3,
            target_reps:  ex.target_reps || '8-12',
            rest_seconds: ex.rest_seconds || 90,
          }
        })
        .filter(Boolean),
    }))

    // Save program to DB
    const { data: program, error: progErr } = await supabase
      .from('programs')
      .insert({
        user_id:       user.id,
        name:          plan.program_name,
        goal:          profile?.goal ?? 'muscle_gain',
        duration_weeks,
        days_per_week,
        ai_generated:  true,
      })
      .select('id').single()

    if (progErr || !program) return NextResponse.json({ error: 'Failed to save program' }, { status: 500 })

    const { data: week } = await supabase
      .from('program_weeks')
      .insert({ program_id: program.id, week_number: 1, is_deload: false })
      .select('id').single()

    for (const session of sessions) {
      const { data: sess } = await supabase
        .from('sessions')
        .insert({ program_week_id: week!.id, user_id: user.id, day_of_week: session.day_of_week, focus: session.focus })
        .select('id').single()

      if (sess && session.exercises.length > 0) {
        await supabase.from('session_exercises').insert(
          session.exercises.map((ex: any) => ({ session_id: sess.id, ...ex }))
        )
      }
    }

    return NextResponse.json({
      program_id:          program.id,
      program_name:        plan.program_name,
      sessions_count:      sessions.length,
      training_day_notes:  plan.training_day_notes,
      rest_day_notes:      plan.rest_day_notes,
    })

  } catch (e) {
    console.error('AI generation error:', e)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
