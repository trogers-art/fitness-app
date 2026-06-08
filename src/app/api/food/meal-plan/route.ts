import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: plan } = await supabase
    .from('ai_plans')
    .select('id, plan_data, created_at')
    .eq('user_id', user.id)
    .eq('plan_type', 'food')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return NextResponse.json({ plan: plan || null })
}

export async function PUT(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { plan_id, plan_data } = await request.json()
  if (!plan_id || !plan_data) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const { error } = await supabase
    .from('ai_plans')
    .update({ plan_data })
    .eq('id', plan_id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: 'Save failed' }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function POST() {
  const supabase  = createClient()
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('goal, units, daily_calories, protein_g, carbs_g, fat_g, weight_kg, activity_level')
    .eq('user_id', user.id).single()
  if (!profile) return new Response('No profile', { status: 400 })

  const { data: activeProgram } = await supabase
    .from('programs')
    .select('name, program_weeks ( sessions ( day_of_week, focus ) )')
    .eq('user_id', user.id).eq('active', true).single()

  const trainingDays: number[] = []
  if (activeProgram) {
    const sessions = activeProgram.program_weeks?.flatMap((w: any) => w.sessions) ?? []
    sessions.forEach((s: any) => { if (!trainingDays.includes(s.day_of_week)) trainingDays.push(s.day_of_week) })
  }

  const DAY_NAMES = ['','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
  const restDays  = [1,2,3,4,5,6,7].filter(d => !trainingDays.includes(d))
  const imperial  = profile.units === 'imperial'
  const weightDisp = imperial ? `${Math.round((profile.weight_kg||80)*2.20462)}lbs` : `${profile.weight_kg}kg`

  const trainCals  = profile.daily_calories
  const restCals   = Math.round(profile.daily_calories * 0.85)
  const protein    = profile.protein_g
  const trainCarbs = profile.carbs_g
  const restCarbs  = Math.round(profile.carbs_g * 0.75)
  const fat        = profile.fat_g

  // Meal types to generate
  const baseMealTypes = [
    { type: 'breakfast',   label: 'Breakfast',    training: true, rest: true  },
    { type: 'lunch',       label: 'Lunch',        training: true, rest: true  },
    { type: 'dinner',      label: 'Dinner',       training: true, rest: true  },
    { type: 'snack',       label: 'Snack',        training: false,rest: true  },
    { type: 'pre_workout', label: 'Pre-workout',  training: true, rest: false },
    { type: 'post_workout',label: 'Post-workout', training: true, rest: false },
  ]

  // Build day context string
  const dayContext = [1,2,3,4,5,6,7].map(d => {
    const isTrain = trainingDays.includes(d)
    return `${DAY_NAMES[d]}(${isTrain?'training':'rest'} ${isTrain?trainCals:restCals}kcal)`
  }).join(', ')

  // SSE stream
  const encoder = new TextEncoder()
  const stream  = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      // Structure: days[dow] = { meals: { meal_type: { options: [...] } } }
      const dayMap: Record<number, any> = {}
      for (let d = 1; d <= 7; d++) {
        const isTrain = trainingDays.includes(d)
        dayMap[d] = {
          day_of_week:     d,
          day_name:        DAY_NAMES[d],
          is_training:     isTrain,
          target_calories: isTrain ? trainCals : restCals,
          target_protein:  protein,
          target_carbs:    isTrain ? trainCarbs : restCarbs,
          target_fat:      fat,
          meals:           [],
        }
      }

      // Delete old plan and create new record
      await supabase.from('ai_plans').delete().eq('user_id', user.id).eq('plan_type', 'food')
      const { data: planRecord } = await supabase
        .from('ai_plans')
        .insert({ user_id: user.id, plan_type: 'food', plan_data: { training_days: trainingDays, days: [], notes: '' } })
        .select('id').single()
      const planId = planRecord?.id

      // Generate one meal type at a time across all 7 days
      for (const mealDef of baseMealTypes) {
        // Skip if not applicable to any day
        const applicableDays = [1,2,3,4,5,6,7].filter(d => {
          const isTrain = trainingDays.includes(d)
          return (isTrain && mealDef.training) || (!isTrain && mealDef.rest)
        })
        if (applicableDays.length === 0) continue

        send({ type: 'progress', meal_type: mealDef.type, label: mealDef.label })

        // Build per-day targets for this meal type
        const dayTargets = applicableDays.map(d => {
          const isTrain = trainingDays.includes(d)
          const cals = isTrain ? trainCals : restCals
          const carbs = isTrain ? trainCarbs : restCarbs
          // Rough per-meal allocation
          const mealAllocs: Record<string, number> = {
            breakfast: 0.25, lunch: 0.30, dinner: 0.30,
            snack: 0.10, pre_workout: 0.10, post_workout: 0.15,
          }
          const alloc = mealAllocs[mealDef.type] || 0.2
          return `${DAY_NAMES[d]}: ${Math.round(cals*alloc)}kcal ${Math.round(protein*alloc)}p ${Math.round(carbs*alloc)}c ${Math.round(fat*alloc)}f`
        }).join(' | ')

        const prompt = `Sports dietitian. Generate ${mealDef.label} options for all applicable days. JSON only, no markdown.

User: Goal=${profile.goal.replace('_',' ')} Weight=${weightDisp}
Week: ${dayContext}
This meal type: ${mealDef.label}
Applicable days + targets: ${dayTargets}

Rules:
- Each day gets 2 options (option_key "a" and "b")
- Each option has 2-4 foods with accurate macros
- Vary foods significantly across all days — no repeating same option
- Foods should be practical and realistic
- Macros per option should match the day's target for this meal

JSON format:
{"meal_type":"${mealDef.type}","label":"${mealDef.label}","days":[{"day_of_week":1,"options":[{"option_key":"a","label":"NAME","total_calories":0,"total_protein":0,"total_carbs":0,"total_fat":0,"foods":[{"id":"f1","name":"FOOD","serving":"SERVING","calories":0,"protein":0,"carbs":0,"fat":0}]},{"option_key":"b","label":"NAME","total_calories":0,"total_protein":0,"total_carbs":0,"total_fat":0,"foods":[]}]}]}`

        try {
          const message = await anthropic.messages.create({
            model:      'claude-sonnet-4-20250514',
            max_tokens: 4000,
            messages:   [{ role: 'user', content: prompt }],
          })

          const text  = message.content.find((b: any) => b.type === 'text')?.text ?? ''
          const clean = text.replace(/```json|```/g, '').trim()
          const result = JSON.parse(clean)

          // Merge into dayMap
          for (const dayResult of (result.days || [])) {
            const dow = dayResult.day_of_week
            if (!dayMap[dow]) continue
            dayMap[dow].meals.push({
              meal_type: mealDef.type,
              label:     mealDef.label,
              options:   dayResult.options || [],
            })
          }

          // Save incremental progress
          const days = Object.values(dayMap).filter((d: any) => d.meals.length > 0)
          if (planId) {
            await supabase.from('ai_plans')
              .update({ plan_data: { training_days: trainingDays, days, notes: '' } })
              .eq('id', planId)
          }

          send({ type: 'meal_done', meal_type: mealDef.type, label: mealDef.label, days: result.days })

        } catch (e) {
          console.error(`${mealDef.label} generation error:`, e)
          send({ type: 'error', meal_type: mealDef.type, label: mealDef.label })
        }
      }

      const notes = `${profile.goal === 'fat_loss' ? 'Calorie deficit maintained. ' : ''}Protein prioritised at every meal. Training days have higher carbs for performance and recovery.`
      if (planId) {
        const days = Object.values(dayMap)
        await supabase.from('ai_plans')
          .update({ plan_data: { training_days: trainingDays, days, notes } })
          .eq('id', planId)
      }

      send({ type: 'done', plan_id: planId, notes })
      controller.close()
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    },
  })
}
