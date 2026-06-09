import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'

const GenerateSchema = z.object({
  days_per_week:  z.number().int().min(1).max(7),
  duration_weeks: z.number().int().min(1).max(16).default(8),
  experience:     z.enum(['beginner','intermediate','advanced']),
  equipment:      z.array(z.string()).min(1),
  injuries:       z.string().optional(),
})

// ── Split definitions ──────────────────────────────────────────────────────

const SPLITS: Record<string, Record<number, { focus: string; muscles: string[] }[]>> = {
  fat_loss: {
    3: [
      { focus: 'Full Body A', muscles: ['chest','back','quads','hamstrings','shoulders','core'] },
      { focus: 'Full Body B', muscles: ['chest','back','glutes','hamstrings','triceps','biceps','core'] },
      { focus: 'Full Body C', muscles: ['shoulders','back','quads','glutes','triceps','biceps','core'] },
    ],
    4: [
      { focus: 'Upper A',     muscles: ['chest','back','shoulders','triceps','biceps'] },
      { focus: 'Lower A',     muscles: ['quads','hamstrings','glutes','calves','core'] },
      { focus: 'Upper B',     muscles: ['chest','back','shoulders','triceps','biceps'] },
      { focus: 'Lower B',     muscles: ['quads','hamstrings','glutes','calves','core'] },
    ],
    5: [
      { focus: 'Upper A',     muscles: ['chest','back','shoulders','triceps','biceps'] },
      { focus: 'Lower A',     muscles: ['quads','hamstrings','glutes','calves','core'] },
      { focus: 'Full Body',   muscles: ['chest','back','quads','hamstrings','shoulders','core'] },
      { focus: 'Upper B',     muscles: ['chest','back','shoulders','triceps','biceps'] },
      { focus: 'Lower B',     muscles: ['quads','hamstrings','glutes','calves','core'] },
    ],
    6: [
      { focus: 'Push A',      muscles: ['chest','shoulders','triceps'] },
      { focus: 'Pull A',      muscles: ['back','biceps','forearms'] },
      { focus: 'Legs A',      muscles: ['quads','hamstrings','glutes','calves'] },
      { focus: 'Push B',      muscles: ['chest','shoulders','triceps'] },
      { focus: 'Pull B',      muscles: ['back','biceps','forearms'] },
      { focus: 'Legs B',      muscles: ['quads','hamstrings','glutes','calves'] },
    ],
  },
  muscle_gain: {
    3: [
      { focus: 'Push',            muscles: ['chest','shoulders','triceps'] },
      { focus: 'Pull',            muscles: ['back','biceps','forearms'] },
      { focus: 'Legs',            muscles: ['quads','hamstrings','glutes','calves'] },
    ],
    4: [
      { focus: 'Chest & Triceps', muscles: ['chest','triceps'] },
      { focus: 'Back & Biceps',   muscles: ['back','biceps','forearms'] },
      { focus: 'Legs',            muscles: ['quads','hamstrings','glutes','calves'] },
      { focus: 'Shoulders & Arms',muscles: ['shoulders','biceps','triceps'] },
    ],
    5: [
      { focus: 'Chest & Triceps', muscles: ['chest','triceps'] },
      { focus: 'Back & Biceps',   muscles: ['back','biceps','forearms'] },
      { focus: 'Legs',            muscles: ['quads','hamstrings','glutes','calves'] },
      { focus: 'Shoulders & Arms',muscles: ['shoulders','biceps','triceps','forearms'] },
      { focus: 'Full Body',       muscles: ['chest','back','quads','hamstrings','shoulders','core'] },
    ],
    6: [
      { focus: 'Push A',          muscles: ['chest','shoulders','triceps'] },
      { focus: 'Pull A',          muscles: ['back','biceps','forearms'] },
      { focus: 'Legs A',          muscles: ['quads','hamstrings','glutes','calves'] },
      { focus: 'Push B',          muscles: ['chest','shoulders','triceps'] },
      { focus: 'Pull B',          muscles: ['back','biceps','forearms'] },
      { focus: 'Legs B',          muscles: ['quads','hamstrings','glutes','calves'] },
    ],
  },
  maintain: {
    3: [
      { focus: 'Full Body A', muscles: ['chest','back','quads','hamstrings','shoulders','core'] },
      { focus: 'Full Body B', muscles: ['chest','back','glutes','hamstrings','triceps','biceps'] },
      { focus: 'Full Body C', muscles: ['shoulders','back','quads','glutes','core'] },
    ],
    4: [
      { focus: 'Upper A',     muscles: ['chest','back','shoulders','triceps','biceps'] },
      { focus: 'Lower A',     muscles: ['quads','hamstrings','glutes','calves','core'] },
      { focus: 'Upper B',     muscles: ['chest','back','shoulders','triceps','biceps'] },
      { focus: 'Lower B',     muscles: ['quads','hamstrings','glutes','calves','core'] },
    ],
    5: [
      { focus: 'Push',        muscles: ['chest','shoulders','triceps'] },
      { focus: 'Pull',        muscles: ['back','biceps','forearms'] },
      { focus: 'Legs',        muscles: ['quads','hamstrings','glutes','calves'] },
      { focus: 'Upper',       muscles: ['chest','back','shoulders','triceps','biceps'] },
      { focus: 'Lower',       muscles: ['quads','hamstrings','glutes','calves','core'] },
    ],
    6: [
      { focus: 'Push A',      muscles: ['chest','shoulders','triceps'] },
      { focus: 'Pull A',      muscles: ['back','biceps','forearms'] },
      { focus: 'Legs A',      muscles: ['quads','hamstrings','glutes','calves'] },
      { focus: 'Push B',      muscles: ['chest','shoulders','triceps'] },
      { focus: 'Pull B',      muscles: ['back','biceps','forearms'] },
      { focus: 'Legs B',      muscles: ['quads','hamstrings','glutes','calves'] },
    ],
  },
}

// Goal-specific programming parameters
const GOAL_PARAMS = {
  fat_loss: {
    sets:       '3-4',
    reps:       '12-15',
    rest:       60,
    style:      'Higher rep ranges, shorter rest periods, superset where possible. Prioritise compound movements first, then add isolation. Keep sessions metabolically demanding.',
    compounds:  4,
    isolation:  2,
  },
  muscle_gain: {
    sets:       '3-5',
    reps:       '6-12',
    rest:       90,
    style:      'Progressive overload focus. Lead with heavy compound movements (3-5 sets, 6-8 reps), follow with volume work (3-4 sets, 10-12 reps). Include isolation finishers.',
    compounds:  3,
    isolation:  3,
  },
  maintain: {
    sets:       '3-4',
    reps:       '8-12',
    rest:       75,
    style:      'Balanced approach. Mix compound and isolation movements. Moderate volume and intensity.',
    compounds:  3,
    isolation:  2,
  },
}

// Map session muscles to exercise muscle_group values
const MUSCLE_MAP: Record<string, string[]> = {
  chest:      ['chest'],
  back:       ['back'],
  shoulders:  ['shoulders'],
  biceps:     ['biceps'],
  triceps:    ['triceps'],
  forearms:   ['forearms'],
  quads:      ['quads'],
  hamstrings: ['hamstrings'],
  glutes:     ['glutes'],
  calves:     ['calves'],
  core:       ['core'],
  full_body:  ['chest','back','shoulders','quads','hamstrings','glutes','core'],
}

// Assign days of week to sessions, skipping rest days
function assignDays(
  sessions: { focus: string; muscles: string[] }[],
  daysPerWeek: number
): { day_of_week: number; focus: string; muscles: string[] }[] {
  const daySlots: Record<number, number[]> = {
    1: [1],
    2: [1,4],
    3: [1,3,5],
    4: [1,2,4,5],
    5: [1,2,3,5,6],
    6: [1,2,3,4,5,6],
    7: [1,2,3,4,5,6,7],
  }
  const slots = daySlots[daysPerWeek] || [1,2,3,4,5]
  return sessions.map((session, i) => ({
    day_of_week: slots[i] ?? i + 1,
    focus:       session.focus,
    muscles:     session.muscles,
  }))
}

// ── FIX: equipment is stored as a plain string in the DB, not an array ──────
// ExerciseDB API returns equipment as a single string (e.g. "dumbbell", "barbell").
// The old code called .some() on a string which always returned false,
// causing nearly every exercise to be filtered out (leaving only 1-2 per session).
function equipmentMatches(exEquipment: string | string[] | null | undefined, userEquipment: string[]): boolean {
  if (!exEquipment) return true
  // DB rows may have stored equipment as an array (old ingestion) or a string (ExerciseDB API)
  const eqValues: string[] = Array.isArray(exEquipment) ? exEquipment : [exEquipment]
  return eqValues.some(raw => {
    if (typeof raw !== 'string') return false
    const eq = raw.toLowerCase().trim()
    if (eq === 'body weight' || eq === 'bodyweight') return true
    return userEquipment.some(e => e.toLowerCase().trim() === eq)
  })
}

// ── FIX: fuzzy name matching so minor casing/spacing differences don't drop exercises ──
// Build a normalised key by lowercasing and collapsing whitespace.
function normaliseName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim()
}

export async function POST(request: NextRequest) {
  const supabase  = createClient()
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await request.json()
  const parsed = GenerateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { days_per_week, duration_weeks, experience, equipment, injuries } = parsed.data

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('goal, weight_kg, age, sex, activity_level, daily_calories, protein_g')
    .eq('user_id', user.id).single()

  const goal      = (profile?.goal ?? 'muscle_gain') as keyof typeof SPLITS
  const goalParam = GOAL_PARAMS[goal] || GOAL_PARAMS.muscle_gain

  // Get split for goal + days
  const splitKey = Math.min(days_per_week, 6)
  const rawSplit = SPLITS[goal]?.[splitKey] || SPLITS.muscle_gain[Math.min(days_per_week, 6)]
  const sessions = assignDays(rawSplit, days_per_week)

  // Fetch all exercises for the muscles used across this program
  const allMuscles = [...new Set(sessions.flatMap(s => s.muscles))]
  const { data: allExercises } = await supabase
    .from('exercises')
    .select('id, name, muscle_group, equipment, type')
    .is('user_id', null)
    .in('muscle_group', allMuscles)
    .order('name')

  // Deactivate existing programs
  await supabase.from('programs').update({ active: false }).eq('user_id', user.id)

  // Create program
  const imperial    = profile?.weight_kg ? Math.round(profile.weight_kg * 2.20462) + ' lbs' : 'unknown'
  const programName = `${goal.replace('_', ' ')} · ${days_per_week}×/week · ${experience}`

  const { data: program, error: progErr } = await supabase
    .from('programs')
    .insert({
      user_id: user.id, name: programName, goal,
      duration_weeks, days_per_week,
      ai_generated: true, active: true,
    })
    .select('id').single()

  if (progErr || !program) return NextResponse.json({ error: 'Failed to create program' }, { status: 500 })

  const { data: week } = await supabase
    .from('program_weeks')
    .insert({ program_id: program.id, week_number: 1, is_deload: false })
    .select('id').single()

  // Generate each session separately — small prompt, guaranteed to fit
  for (const session of sessions) {
    const sessionMuscles = session.muscles.flatMap(m => MUSCLE_MAP[m] || [m])

    // ── FIX 1: equipment comparison uses string equality, not .some() on a string ──
    const sessionExercises = (allExercises || []).filter(ex =>
      sessionMuscles.includes(ex.muscle_group) &&
      equipmentMatches(ex.equipment, equipment)
    )

    // Group by muscle for the prompt — cap at 12 per muscle to stay within token budget
    const byMuscle: Record<string, string[]> = {}
    for (const ex of sessionExercises) {
      if (!byMuscle[ex.muscle_group]) byMuscle[ex.muscle_group] = []
      byMuscle[ex.muscle_group].push(ex.name)
    }
    const exerciseList = Object.entries(byMuscle)
      .map(([m, exs]) => `${m.toUpperCase()}: ${exs.slice(0, 12).join(', ')}`)
      .join('\n')

    const minExercises = goalParam.compounds + goalParam.isolation

    const prompt = `Strength coach. Generate ONE training session. JSON only, no markdown.

Session: ${session.focus}
Goal: ${goal.replace('_', ' ')} | Experience: ${experience} | Weight: ${imperial}
Style: ${goalParam.style}
Rep ranges: ${goalParam.reps} | Rest: ${goalParam.rest}s | Sets: ${goalParam.sets}
YOU MUST include EXACTLY ${minExercises} to 8 exercises. DO NOT return fewer than ${minExercises}.
${injuries ? `Avoid: ${injuries}` : ''}

AVAILABLE EXERCISES (use exact names only):
${exerciseList}

Rules:
- Start with compound movements, finish with isolation
- Each exercise: target_sets, target_reps, rest_seconds, order_index (0-based)
- Use ONLY exercise names from the list above — exact spelling
- Return ${minExercises} exercises minimum, 8 maximum

JSON:
{"exercises":[{"exercise_name":"EXACT NAME","target_sets":3,"target_reps":"8-12","rest_seconds":90,"order_index":0}]}`

    try {
      const message = await anthropic.messages.create({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages:   [{ role: 'user', content: prompt }],
      })

      const text  = (message.content.find((b: any) => b.type === 'text') as any)?.text ?? ''
      const clean = text.replace(/```json|```/g, '').trim()
      const result: any = JSON.parse(clean)

      // ── FIX 2: build nameToId from sessionExercises (what Claude actually saw),
      // not allExercises. Use normalised keys so minor whitespace/casing diffs match. ──
      const nameToId: Record<string, string> = {}
      for (const ex of sessionExercises) {
        nameToId[normaliseName(ex.name)] = ex.id
      }

      const sessionExs = (result.exercises || [])
        .map((ex: any, i: number) => {
          const key = normaliseName(ex.exercise_name ?? '')
          const id  = nameToId[key]
          if (!id) {
            console.warn(`[workout-gen] No DB match for: "${ex.exercise_name}" (normalised: "${key}")`)
            return null
          }
          return {
            exercise_id:  id,
            order_index:  i,
            target_sets:  ex.target_sets  || 3,
            target_reps:  ex.target_reps  || goalParam.reps,
            rest_seconds: ex.rest_seconds || goalParam.rest,
          }
        })
        .filter(Boolean)

      // Log how many survived matching so we can catch regressions
      console.log(`[workout-gen] ${session.focus}: Claude returned ${result.exercises?.length ?? 0}, matched ${sessionExs.length}`)

      const { data: sess } = await supabase
        .from('sessions')
        .insert({
          program_week_id: week!.id,
          user_id:         user.id,
          day_of_week:     session.day_of_week,
          focus:           session.focus,
        })
        .select('id').single()

      if (sess && sessionExs.length > 0) {
        await supabase.from('session_exercises').insert(
          sessionExs.map((ex: any) => ({ session_id: sess.id, ...ex }))
        )
      }
    } catch (e: unknown) {
      console.error(`[workout-gen] Session ${session.focus} error:`, e)
    }
  }

  const trainingDayNotes = `${goal === 'fat_loss' ? 'Eat in a deficit. ' : ''}Consume protein within 60 min post-workout. Carbs pre-workout for energy.`
  const restDayNotes     = `${goal === 'fat_loss' ? 'Lower carbs on rest days. ' : ''}Keep protein high. Light activity like walking is encouraged.`

  return NextResponse.json({
    program_id:         program.id,
    program_name:       programName,
    sessions_count:     sessions.length,
    training_day_notes: trainingDayNotes,
    rest_day_notes:     restDayNotes,
  })
}
