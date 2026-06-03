import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { FitnessPlanResponseSchema } from '@/lib/validators'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MAX_RETRIES = 2

const FitnessPlanRequestSchema = z.object({
  days_per_week: z.number().int().min(2).max(6),
  experience: z.enum(['beginner', 'intermediate', 'advanced']),
  equipment: z.array(z.string()).min(1),
  duration_weeks: z.number().int().min(4).max(16).default(8),
  session_max_minutes: z.number().int().min(20).max(120).default(60),
})

function buildSystemPrompt(goal: string): string {
  const goalRules: Record<string, string> = {
    fat_loss: `- Use hypertrophy rep ranges (8-15 reps) to preserve muscle
- Include 2 cardio sessions per week (LISS or HIIT)
- Keep sessions under 60 minutes (cortisol management)
- Progressive overload every 2 weeks
- Prioritise compound lifts for calorie burn
- Cardio on separate days or post-weights`,
    muscle_gain: `- Alternate strength (4-6 reps) and hypertrophy (8-12 reps) blocks
- Progressive overload on main lifts weekly
- Week 4 and week 8 are deload weeks (reduce volume 40%)
- Volume: 10-20 working sets per muscle group per week
- Prioritise big compound movements`,
    maintain: `- Mixed rep ranges (6-15 reps)
- Progressive overload every 3 weeks
- Balance strength and conditioning
- 3-4 sessions per week maximum`,
  }

  return `You are a certified strength and conditioning coach. Generate a detailed training program as JSON only.
Goal-specific rules for ${goal}:
${goalRules[goal] || goalRules.maintain}
General rules:
- Warm-up sets not included in working sets
- Never schedule the same muscle group on consecutive days
- Output ONLY valid JSON. No prose, no markdown, no code fences.`
}

function buildUserPrompt(profile: Record<string, unknown>, options: z.infer<typeof FitnessPlanRequestSchema>): string {
  return `Generate a ${options.duration_weeks}-week training program:
Goal: ${profile.goal}
Days per week: ${options.days_per_week}
Experience: ${options.experience}
Equipment: ${options.equipment.join(', ')}
Max session length: ${options.session_max_minutes} minutes

Return JSON with this exact structure:
{
  "program_name": string,
  "goal": string,
  "weeks": [
    {
      "week_number": number,
      "is_deload": boolean,
      "sessions": [
        {
          "day_of_week": number (1=Mon, 7=Sun),
          "focus": string,
          "exercises": [
            {
              "exercise_name": string,
              "order_index": number,
              "target_sets": number,
              "target_reps": string,
              "target_weight_note": string,
              "rest_seconds": number
            }
          ]
        }
      ]
    }
  ],
  "progression_notes": string
}`
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const optionsParsed = FitnessPlanRequestSchema.safeParse(body)
    if (!optionsParsed.success) {
      return NextResponse.json({ error: 'Invalid options', details: optionsParsed.error.flatten() }, { status: 400 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found. Complete onboarding first.' }, { status: 400 })
    }

    // Load exercise library for name validation
    const { data: exercises } = await supabase
      .from('exercises')
      .select('id, name')
      .limit(2000)

    const exerciseNameMap = new Map<string, string>(
      (exercises || []).map(e => [e.name.toLowerCase(), e.id])
    )

    let lastError: Error | null = null
    let parsed = null

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const correctionNote = attempt > 0
        ? `\n\nPrevious attempt failed: ${lastError?.message}. Fix and retry.`
        : ''

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        system: buildSystemPrompt(profile.goal),
        messages: [{ role: 'user', content: buildUserPrompt(profile, optionsParsed.data) + correctionNote }],
      })

      const text = response.content[0].type === 'text' ? response.content[0].text : ''
      const cleanText = text.replace(/```json|```/g, '').trim()

      try {
        const json = JSON.parse(cleanText)
        const result = FitnessPlanResponseSchema.safeParse(json)
        if (result.success) {
          parsed = result.data
          break
        } else {
          lastError = new Error(JSON.stringify(result.error.flatten()))
        }
      } catch (e) {
        lastError = new Error(`JSON parse failed: ${e}`)
      }
    }

    if (!parsed) {
      console.error('Fitness plan generation failed:', lastError)
      return NextResponse.json({ error: 'Failed to generate fitness plan. Please try again.' }, { status: 500 })
    }

    // Write program to DB
    const { data: program, error: programError } = await supabase
      .from('programs')
      .insert({
        user_id: user.id,
        name: parsed.program_name,
        goal: parsed.goal,
        duration_weeks: parsed.weeks.length,
        days_per_week: optionsParsed.data.days_per_week,
        ai_generated: true,
        template: false,
        active: false,
      })
      .select()
      .single()

    if (programError || !program) {
      return NextResponse.json({ error: 'Failed to save program' }, { status: 500 })
    }

    // Write weeks, sessions, exercises
    for (const week of parsed.weeks) {
      const { data: programWeek } = await supabase
        .from('program_weeks')
        .insert({ program_id: program.id, week_number: week.week_number, is_deload: week.is_deload })
        .select()
        .single()

      if (!programWeek) continue

      for (const session of week.sessions) {
        const { data: sessionRow } = await supabase
          .from('sessions')
          .insert({
            program_week_id: programWeek.id,
            user_id: user.id,
            day_of_week: session.day_of_week,
            focus: session.focus,
            planned: true,
          })
          .select()
          .single()

        if (!sessionRow) continue

        for (const ex of session.exercises) {
          // Match exercise name to library (fuzzy — lowercase)
          const exerciseId = exerciseNameMap.get(ex.exercise_name.toLowerCase())

          if (exerciseId) {
            await supabase.from('session_exercises').insert({
              session_id: sessionRow.id,
              exercise_id: exerciseId,
              order_index: ex.order_index,
              target_sets: ex.target_sets,
              target_reps: ex.target_reps,
              rest_seconds: ex.rest_seconds,
            })
          }
          // Unknown exercises are silently skipped — user can add manually
        }
      }
    }

    await supabase.from('ai_plans').insert({
      user_id: user.id,
      type: 'fitness',
      response_json: parsed,
    })

    return NextResponse.json({ program_id: program.id, program_name: program.name })
  } catch (err) {
    console.error('Fitness plan route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
