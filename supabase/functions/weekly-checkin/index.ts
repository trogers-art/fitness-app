import Anthropic from 'npm:@anthropic-ai/sdk'
import { createClient } from 'npm:@supabase/supabase-js'
import { z } from 'npm:zod'

const CheckinResponseSchema = z.object({
  new_daily_calories: z.number().min(800).max(8000),
  calorie_adjustment: z.number().min(-500).max(500),
  program_load: z.enum(['maintain', 'progress', 'deload']),
  explanation: z.string().min(20),
})

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

  // Get all users with profiles
  const { data: profiles } = await supabase.from('user_profiles').select('user_id, goal, daily_calories, target_rate_kg_per_week, weight_kg')
  if (!profiles) return new Response('No profiles', { status: 200 })

  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - 7)
  const weekStartStr = weekStart.toISOString().split('T')[0]
  const todayStr = new Date().toISOString().split('T')[0]

  let processed = 0

  for (const profile of profiles) {
    try {
      // Aggregate last 7 days of data
      const [nutritionRes, workoutsRes, bodyRes, habitsRes] = await Promise.all([
        supabase.from('daily_nutrition_summaries')
          .select('total_calories')
          .eq('user_id', profile.user_id)
          .gte('date', weekStartStr)
          .lte('date', todayStr),
        supabase.from('workout_logs')
          .select('id')
          .eq('user_id', profile.user_id)
          .gte('completed_at', weekStart.toISOString()),
        supabase.from('body_metrics')
          .select('weight_kg, logged_at')
          .eq('user_id', profile.user_id)
          .gte('logged_at', weekStart.toISOString())
          .order('logged_at', { ascending: true }),
        supabase.from('habit_logs')
          .select('id')
          .eq('user_id', profile.user_id)
          .gte('completed_at', weekStart.toISOString()),
      ])

      const nutritionData = nutritionRes.data || []
      const avgCals = nutritionData.length > 0
        ? Math.round(nutritionData.reduce((s, n) => s + n.total_calories, 0) / nutritionData.length)
        : profile.daily_calories

      const bodyData = bodyRes.data || []
      const weightStart = bodyData[0]?.weight_kg || profile.weight_kg
      const weightEnd = bodyData[bodyData.length - 1]?.weight_kg || profile.weight_kg

      const habitLogs = habitsRes.data || []
      const { data: totalHabits } = await supabase
        .from('habits')
        .select('id', { count: 'exact' })
        .eq('user_id', profile.user_id)
        .eq('active', true)
        .eq('frequency', 'daily')
      const expectedHabitLogs = (totalHabits?.length || 0) * 7
      const habitPct = expectedHabitLogs > 0 ? Math.round((habitLogs.length / expectedHabitLogs) * 100) : 0

      const inputs = {
        avg_calories_eaten: avgCals,
        target_calories: profile.daily_calories,
        workouts_completed: workoutsRes.data?.length || 0,
        workouts_planned: 4,
        weight_start_of_week: weightStart,
        weight_end_of_week: weightEnd,
        target_weekly_loss: profile.target_rate_kg_per_week,
        habit_completion_pct: habitPct,
      }

      const prompt = `Weekly check-in for a ${profile.goal} user.
Last 7 days data:
- Average calories eaten: ${inputs.avg_calories_eaten} (target: ${inputs.target_calories})
- Workouts completed: ${inputs.workouts_completed}/${inputs.workouts_planned}
- Weight change: ${weightStart}kg → ${weightEnd}kg (target: -${inputs.target_weekly_loss}kg/wk)
- Habit completion: ${habitPct}%

Adjust next week's plan. Return only JSON:
{"new_daily_calories": number, "calorie_adjustment": number, "program_load": "maintain"|"progress"|"deload", "explanation": "one paragraph plain English"}`

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        system: 'You are a coach reviewing weekly data and adjusting plans. Respond ONLY with valid JSON.',
        messages: [{ role: 'user', content: prompt }],
      })

      const text = response.content[0].type === 'text' ? response.content[0].text : ''
      const cleanText = text.replace(/```json|```/g, '').trim()
      const parsed = CheckinResponseSchema.safeParse(JSON.parse(cleanText))

      if (!parsed.success) continue

      const outputs = parsed.data

      // Update user profile calories
      await supabase.from('user_profiles')
        .update({ daily_calories: outputs.new_daily_calories, updated_at: new Date().toISOString() })
        .eq('user_id', profile.user_id)

      // Log the check-in
      await supabase.from('checkin_logs').insert({
        user_id: profile.user_id,
        week_start: weekStartStr,
        inputs,
        outputs,
        explanation: outputs.explanation,
      })

      processed++
    } catch (err) {
      console.error(`Check-in failed for user ${profile.user_id}:`, err)
    }
  }

  return new Response(JSON.stringify({ processed }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
