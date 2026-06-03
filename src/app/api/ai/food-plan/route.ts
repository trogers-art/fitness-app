import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { MealPlanResponseSchema } from '@/lib/validators'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MAX_RETRIES = 2

function buildSystemPrompt(): string {
  return `You are a certified sports nutritionist. Generate a personalised daily meal plan as JSON only.
Rules:
- Every meal must have at least 20g protein
- Minimum daily fibre: 25g
- No liquid calories except protein shakes
- Prioritise whole foods, high volume for fat loss
- Carb cycle: training day carbs ~20% higher than rest day
- Output ONLY valid JSON matching the schema. No prose, no markdown, no code fences.`
}

function buildUserPrompt(profile: Record<string, unknown>): string {
  return `Generate a meal plan for this user:
Goal: ${profile.goal}
Daily calorie target: ${profile.daily_calories} kcal
Protein target: ${profile.protein_g}g
Carbs target: ${profile.carbs_g}g (training) / ${profile.rest_day_carbs_g}g (rest)
Fat target: ${profile.fat_g}g
Body weight: ${profile.weight_kg}kg

Return JSON with this exact structure:
{
  "daily_targets": { "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number, "fibre_g": number },
  "training_day_meals": [ { "meal_type": string, "name": string, "target_calories": number, "target_protein_g": number, "target_carbs_g": number, "target_fat_g": number, "suggested_foods": string[] } ],
  "rest_day_meals": [ ... same structure ... ],
  "notes": string
}`
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Load user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found. Complete onboarding first.' }, { status: 400 })
    }

    let lastError: Error | null = null
    let parsed = null

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const correctionNote = attempt > 0
        ? `\n\nPrevious attempt failed validation: ${lastError?.message}. Fix the JSON and retry.`
        : ''

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        system: buildSystemPrompt(),
        messages: [{ role: 'user', content: buildUserPrompt(profile) + correctionNote }],
      })

      const text = response.content[0].type === 'text' ? response.content[0].text : ''
      const cleanText = text.replace(/```json|```/g, '').trim()

      try {
        const json = JSON.parse(cleanText)
        const result = MealPlanResponseSchema.safeParse(json)

        if (result.success) {
          // Validate macros are within 5% of targets
          const { daily_targets } = result.data
          const calorieDiff = Math.abs(daily_targets.calories - profile.daily_calories) / profile.daily_calories
          if (calorieDiff > 0.05) {
            lastError = new Error(`Calorie total ${daily_targets.calories} deviates >5% from target ${profile.daily_calories}`)
            continue
          }
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
      console.error('Food plan generation failed after retries:', lastError)
      return NextResponse.json({ error: 'Failed to generate meal plan. Please try again.' }, { status: 500 })
    }

    // Save to meal_plans and ai_plans
    const { data: mealPlan, error: saveError } = await supabase
      .from('meal_plans')
      .upsert(
        {
          user_id: user.id,
          ai_generated: true,
          daily_targets: parsed.daily_targets,
          training_day_meals: parsed.training_day_meals,
          rest_day_meals: parsed.rest_day_meals,
          notes: parsed.notes,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single()

    if (saveError) {
      console.error('Meal plan save error:', saveError)
      return NextResponse.json({ error: 'Failed to save meal plan' }, { status: 500 })
    }

    await supabase.from('ai_plans').insert({
      user_id: user.id,
      type: 'food',
      response_json: parsed,
    })

    return NextResponse.json({ meal_plan: mealPlan })
  } catch (err) {
    console.error('Food plan route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
