import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Return the most recent saved meal plan
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

export async function POST() {
  const supabase   = createClient()
  const anthropic  = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch profile
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('goal, units, daily_calories, protein_g, carbs_g, fat_g, training_day_carbs_g, rest_day_carbs_g, weight_kg, activity_level')
    .eq('user_id', user.id).single()

  if (!profile) return NextResponse.json({ error: 'No profile found' }, { status: 400 })

  // Fetch active program to determine training days
  const { data: activeProgram } = await supabase
    .from('programs')
    .select(`program_weeks ( sessions ( day_of_week, focus ) )`)
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  const trainingDays: number[] = []
  if (activeProgram) {
    const sessions = activeProgram.program_weeks?.flatMap((w: any) => w.sessions) ?? []
    sessions.forEach((s: any) => { if (!trainingDays.includes(s.day_of_week)) trainingDays.push(s.day_of_week) })
  }
  const dayNames = ['','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
  const trainingDayNames = trainingDays.map(d => dayNames[d]).join(', ') || 'not set'
  const restDayNames     = [1,2,3,4,5,6,7].filter(d => !trainingDays.includes(d)).map(d => dayNames[d]).join(', ')

  const imperial = profile.units === 'imperial'
  const weightDisplay = imperial
    ? `${Math.round(profile.weight_kg * 2.20462)} lbs`
    : `${profile.weight_kg} kg`

  // Training day macros — higher carbs
  const trainingCarbs = profile.training_day_carbs_g || profile.carbs_g
  const restCarbs     = profile.rest_day_carbs_g     || Math.round(profile.carbs_g * 0.8)

  const prompt = `You are a registered dietitian. Generate a detailed meal plan for a fitness-focused individual.

USER PROFILE:
- Goal: ${profile.goal.replace('_',' ')}
- Weight: ${weightDisplay}
- Activity: ${profile.activity_level}
- Training days: ${trainingDayNames}
- Rest days: ${restDayNames}

TRAINING DAY TARGETS: ${profile.daily_calories} kcal | ${profile.protein_g}g protein | ${trainingCarbs}g carbs | ${profile.fat_g}g fat
REST DAY TARGETS: ${Math.round(profile.daily_calories * 0.85)} kcal | ${profile.protein_g}g protein | ${restCarbs}g carbs | ${Math.round(profile.fat_g * 1.1)}g fat

Generate a realistic, practical meal plan with whole foods. Include pre/post workout meals on training days.
Each food item must have a realistic serving description and macros.

Respond with ONLY valid JSON, no markdown:
{
  "training_day": {
    "total_calories": 2180,
    "total_protein": 185,
    "total_carbs": 240,
    "total_fat": 58,
    "meals": [
      {
        "meal_type": "breakfast",
        "label": "Breakfast",
        "total_calories": 520,
        "total_protein": 45,
        "total_carbs": 72,
        "total_fat": 8,
        "foods": [
          {
            "name": "Oats",
            "serving": "100g dry",
            "calories": 380,
            "protein": 13,
            "carbs": 66,
            "fat": 7
          }
        ]
      }
    ]
  },
  "rest_day": {
    "total_calories": 1780,
    "total_protein": 180,
    "total_carbs": 160,
    "total_fat": 62,
    "meals": []
  },
  "training_days": ${JSON.stringify(trainingDays)},
  "notes": "Brief overall nutrition note"
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

    // Save to ai_plans table
    const { data: saved } = await supabase
      .from('ai_plans')
      .insert({
        user_id:   user.id,
        plan_type: 'food',
        plan_data: plan,
      })
      .select('id, created_at').single()

    const created_at = saved?.created_at || new Date().toISOString()
    return NextResponse.json({ plan: { id: saved?.id, plan_data: plan, created_at } })
  } catch (e) {
    console.error('Meal plan generation error:', e)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
