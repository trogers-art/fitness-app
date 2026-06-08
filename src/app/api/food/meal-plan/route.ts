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

// Stream generation — one day at a time, sent as SSE
export async function POST(request: NextRequest) {
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
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  const trainingDays: number[] = []
  if (activeProgram) {
    const sessions = activeProgram.program_weeks?.flatMap((w: any) => w.sessions) ?? []
    sessions.forEach((s: any) => { if (!trainingDays.includes(s.day_of_week)) trainingDays.push(s.day_of_week) })
  }

  const DAY_NAMES = ['','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
  const restDays  = [1,2,3,4,5,6,7].filter(d => !trainingDays.includes(d))
  const imperial  = profile.units === 'imperial'
  const weightDisp = imperial ? `${Math.round((profile.weight_kg||80) * 2.20462)}lbs` : `${profile.weight_kg}kg`

  const trainCals  = profile.daily_calories
  const restCals   = Math.round(profile.daily_calories * 0.85)
  const protein    = profile.protein_g
  const trainCarbs = profile.carbs_g
  const restCarbs  = Math.round(profile.carbs_g * 0.75)
  const fat        = profile.fat_g

  // Delete old plan
  await supabase.from('ai_plans').delete().eq('user_id', user.id).eq('plan_type', 'food')

  // Create placeholder plan record
  const { data: planRecord } = await supabase
    .from('ai_plans')
    .insert({ user_id: user.id, plan_type: 'food', plan_data: { training_days: trainingDays, days: [], notes: '' } })
    .select('id').single()

  const planId = planRecord?.id

  const encoder = new TextEncoder()
  const stream  = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      const allDays: any[] = []

      for (let dow = 1; dow <= 7; dow++) {
        const isTraining = trainingDays.includes(dow)
        const cals   = isTraining ? trainCals  : restCals
        const carbs  = isTraining ? trainCarbs : restCarbs
        const meals  = isTraining
          ? 'breakfast, pre_workout, post_workout, lunch, dinner'
          : 'breakfast, lunch, dinner, snack'

        send({ type: 'progress', day: dow, day_name: DAY_NAMES[dow] })

        const dayPrompt = `Sports dietitian. Generate ONE day meal plan as JSON only. No markdown.

User: Goal=${profile.goal.replace('_',' ')} Weight=${weightDisp} Program=${activeProgram?.name||'none'}
Day: ${DAY_NAMES[dow]} (${isTraining ? 'TRAINING' : 'REST'} day)
Targets: ${cals}kcal | ${protein}g protein | ${carbs}g carbs | ${fat}g fat
Meals: ${meals}

Each meal needs EXACTLY 3 options with different foods. Vary from other days.
Foods must have accurate macros. Options across all meals should sum to day targets.

JSON (no other text):
{"day_of_week":${dow},"day_name":"${DAY_NAMES[dow]}","is_training":${isTraining},"target_calories":${cals},"target_protein":${protein},"target_carbs":${carbs},"target_fat":${fat},"meals":[{"meal_type":"breakfast","label":"Breakfast","options":[{"option_key":"a","label":"NAME","total_calories":0,"total_protein":0,"total_carbs":0,"total_fat":0,"foods":[{"id":"f1","name":"FOOD","serving":"SERVING","calories":0,"protein":0,"carbs":0,"fat":0}]}]}]}`

        try {
          const message = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4000,
            messages: [{ role: 'user', content: dayPrompt }],
          })

          const text  = message.content.find((b: any) => b.type === 'text')?.text ?? ''
          const clean = text.replace(/```json|```/g, '').trim()
          const day   = JSON.parse(clean)
          allDays.push(day)

          send({ type: 'day', day: dow, data: day })

          // Update plan in DB incrementally
          if (planId) {
            await supabase.from('ai_plans')
              .update({ plan_data: { training_days: trainingDays, days: allDays, notes: '' } })
              .eq('id', planId)
          }
        } catch (e) {
          console.error(`Day ${dow} generation error:`, e)
          send({ type: 'error', day: dow, message: `Failed to generate ${DAY_NAMES[dow]}` })
        }
      }

      // Final — set notes
      const notes = `${profile.goal === 'fat_loss' ? 'Calorie deficit maintained. ' : ''}Protein prioritised at every meal. Training days have higher carbs for performance and recovery.`
      if (planId) {
        await supabase.from('ai_plans')
          .update({ plan_data: { training_days: trainingDays, days: allDays, notes } })
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
