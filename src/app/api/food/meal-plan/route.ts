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
  // Save edited plan back to DB
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { plan_id, plan_data } = await request.json()
  if (!plan_id || !plan_data) return NextResponse.json({ error: 'Missing plan_id or plan_data' }, { status: 400 })

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
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('goal, units, daily_calories, protein_g, carbs_g, fat_g, weight_kg, activity_level')
    .eq('user_id', user.id).single()

  if (!profile) return NextResponse.json({ error: 'No profile found' }, { status: 400 })

  // Fetch active program training days
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

  const imperial = profile.units === 'imperial'
  const weightLbs = Math.round((profile.weight_kg || 80) * 2.20462)

  // Compute macros
  const trainCals   = profile.daily_calories
  const restCals    = Math.round(profile.daily_calories * 0.85)
  const protein     = profile.protein_g
  const trainCarbs  = profile.carbs_g
  const restCarbs   = Math.round(profile.carbs_g * 0.75)
  const fat         = profile.fat_g

  const prompt = `You are an expert sports dietitian. Generate a COMPLETE 7-day meal plan with variety.

USER:
- Goal: ${profile.goal.replace('_', ' ')}
- Weight: ${imperial ? weightLbs + ' lbs' : profile.weight_kg + ' kg'}
- Training days (${trainingDays.map(d => DAY_NAMES[d]).join(', ') || 'none set'}): ${trainCals} kcal | ${protein}g protein | ${trainCarbs}g carbs | ${fat}g fat
- Rest days (${restDays.map(d => DAY_NAMES[d]).join(', ') || 'none set'}): ${restCals} kcal | ${protein}g protein | ${restCarbs}g carbs | ${fat}g fat
- Active program: ${activeProgram?.name || 'none'}

RULES:
1. Generate ALL 7 days (day_of_week 1=Monday through 7=Sunday)
2. Each meal slot gets EXACTLY 3 options (option_a, option_b, option_c)
3. Each option must hit the day's macro targets when all meals are summed
4. Use VARIED foods across days — no repeating the same option across multiple days
5. Training days include pre_workout and post_workout meals. Rest days do not.
6. Meal types: breakfast, lunch, dinner, snack, pre_workout (training only), post_workout (training only)
7. Each food item needs realistic serving descriptions and accurate macros
8. Make it practical — real foods, reasonable prep time

Respond with ONLY valid JSON, no markdown, no explanation:
{
  "training_days": ${JSON.stringify(trainingDays)},
  "days": [
    {
      "day_of_week": 1,
      "day_name": "Monday",
      "is_training": true,
      "target_calories": ${trainCals},
      "target_protein": ${protein},
      "target_carbs": ${trainCarbs},
      "target_fat": ${fat},
      "meals": [
        {
          "meal_type": "breakfast",
          "label": "Breakfast",
          "options": [
            {
              "option_key": "a",
              "label": "Oats & Protein",
              "total_calories": 480,
              "total_protein": 42,
              "total_carbs": 58,
              "total_fat": 9,
              "foods": [
                {
                  "id": "unique_string_id",
                  "name": "Rolled oats",
                  "serving": "80g dry",
                  "calories": 304,
                  "protein": 10,
                  "carbs": 53,
                  "fat": 6
                }
              ]
            },
            {
              "option_key": "b",
              "label": "Eggs & Toast",
              "total_calories": 490,
              "total_protein": 38,
              "total_carbs": 44,
              "total_fat": 18,
              "foods": []
            },
            {
              "option_key": "c",
              "label": "Greek Yogurt Bowl",
              "total_calories": 470,
              "total_protein": 40,
              "total_carbs": 52,
              "total_fat": 8,
              "foods": []
            }
          ]
        }
      ]
    }
  ],
  "notes": "Brief overall nutrition strategy note"
}`

  try {
    const message = await anthropic.messages.create({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 8000,
      messages:   [{ role: 'user', content: prompt }],
    })

    const text  = message.content.find(b => b.type === 'text')?.text ?? ''
    const clean = text.replace(/```json|```/g, '').trim()
    const plan  = JSON.parse(clean)

    // Delete old food plans for this user
    await supabase.from('ai_plans').delete().eq('user_id', user.id).eq('plan_type', 'food')

    const { data: saved } = await supabase
      .from('ai_plans')
      .insert({ user_id: user.id, plan_type: 'food', plan_data: plan })
      .select('id, created_at').single()

    return NextResponse.json({
      plan: {
        id:         saved?.id,
        plan_data:  plan,
        created_at: saved?.created_at || new Date().toISOString(),
      }
    })
  } catch (e) {
    console.error('Meal plan generation error:', e)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
