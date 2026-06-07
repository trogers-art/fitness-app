import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date().toISOString().split('T')[0]
  // JS day: 0=Sun, 1=Mon... our schema: 1=Mon, 7=Sun
  const jsDay = new Date().getDay()
  const dayOfWeek = jsDay === 0 ? 7 : jsDay

  const [profileRes, nutritionRes, weightsRes, checkinRes, activeProgramRes] = await Promise.all([
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

    // Active program with today's session
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
  ])

  // Find today's session from active program
  const activeProgram = activeProgramRes.data
  const allSessions = activeProgram?.program_weeks?.flatMap((w: any) => w.sessions) ?? []
  const todaySession = allSessions.find((s: any) => s.day_of_week === dayOfWeek) ?? null

  return (
    <DashboardClient
      profile={profileRes.data}
      emailConfirmed={!!user.email_confirmed_at}
      todayNutrition={nutritionRes.data}
      recentWeights={weightsRes.data || []}
      latestCheckin={checkinRes.data?.[0] ?? null}
      activeProgram={activeProgram ? { id: activeProgram.id, name: activeProgram.name } : null}
      todaySession={todaySession}
    />
  )
}
