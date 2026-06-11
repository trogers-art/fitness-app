import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date().toISOString().split('T')[0]
  const jsDay = new Date().getDay()
  const dayOfWeek = jsDay === 0 ? 7 : jsDay

  const [profileRes, nutritionRes, weightsRes, checkinRes, activeProgramRes, habitsRes, habitLogsRes] = await Promise.all([
    supabase.from('user_profiles')
      .select('daily_calories, protein_g, carbs_g, fat_g, units, goal')
      .eq('user_id', user.id).single(),

    supabase.from('daily_nutrition_summaries')
      .select('total_calories, protein_g, carbs_g, fat_g, workout_calories_burned')
      .eq('user_id', user.id).eq('date', today).single(),

    supabase.from('body_metrics')
      .select('weight_kg, logged_at')
      .eq('user_id', user.id)
      .order('logged_at', { ascending: false })
      .limit(14),

    supabase.from('checkin_logs')
      .select('explanation, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1),

    supabase.from('programs')
      .select(`
        id, name,
        program_weeks (
          sessions (
            id, day_of_week, focus,
            session_exercises (
              id, order_index, target_sets, target_reps, rest_seconds,
              exercise:exercises ( id, name, muscle_group, gif_url )
            )
          )
        )
      `)
      .eq('user_id', user.id)
      .eq('active', true)
      .single(),

    supabase.from('habits')
      .select('id, name, type, target_count')
      .eq('user_id', user.id)
      .eq('active', true)
      .order('order_index')
      .order('created_at'),

    supabase.from('habit_logs')
      .select('habit_id, count')
      .eq('user_id', user.id)
      .eq('logged_date', today),
  ])

  const activeProgram = activeProgramRes.data
  const allSessions   = activeProgram?.program_weeks?.flatMap((w: any) => w.sessions) ?? []
  const todaySession  = allSessions.find((s: any) => s.day_of_week === dayOfWeek) ?? null

  // Build today's habit completion map
  const habits   = habitsRes.data || []
  const todayLog = habitLogsRes.data || []
  const logMap: Record<string, number> = {}
  for (const l of todayLog) logMap[l.habit_id] = l.count

  const habitsWithStatus = habits.map((h: any) => ({
    id:     h.id,
    name:   h.name,
    type:   h.type,
    target: h.target_count,
    done:   h.type === 'binary'
              ? logMap[h.id] !== undefined
              : (logMap[h.id] || 0) >= h.target_count,
    count:  logMap[h.id] || 0,
  }))

  return (
    <DashboardClient
      profile={profileRes.data as any}
      emailConfirmed={!!user.email_confirmed_at}
      todayNutrition={nutritionRes.data as any}
      recentWeights={(weightsRes.data || []) as any}
      latestCheckin={(checkinRes.data?.[0] ?? null) as any}
      activeProgram={activeProgram ? { id: activeProgram.id, name: activeProgram.name } : null}
      todaySession={todaySession}
      habits={habitsWithStatus}
    />
  )
}
