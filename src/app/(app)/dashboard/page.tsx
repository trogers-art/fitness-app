import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date().toISOString().split('T')[0]
  const jsDay = new Date().getDay()
  const dayOfWeek = jsDay === 0 ? 7 : jsDay

  const [profileRes, entriesRes, weightsRes, checkinRes, activeProgramRes, habitsRes, habitLogsRes] = await Promise.all([
    supabase.from('user_profiles')
      .select('daily_calories, protein_g, carbs_g, fat_g, units, goal')
      .eq('user_id', user.id).single(),

    // Query food_entries directly — always fresh, no sync dependency
    supabase.from('food_entries')
      .select('calories_total, protein_total, carbs_total, fat_total')
      .eq('user_id', user.id)
      .gte('logged_at', `${today}T00:00:00.000Z`)
      .lte('logged_at', `${today}T23:59:59.999Z`),

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

    // Fetch sessions separately to guarantee ordering
    supabase.from('programs')
      .select('id, name')
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

  // Sum today's nutrition from food_entries directly
  const entries = entriesRes.data || []
  const todayNutrition = entries.length > 0 ? {
    total_calories:          entries.reduce((s, e) => s + (e.calories_total || 0), 0),
    protein_g:               entries.reduce((s, e) => s + (e.protein_total || 0), 0),
    carbs_g:                 entries.reduce((s, e) => s + (e.carbs_total   || 0), 0),
    fat_g:                   entries.reduce((s, e) => s + (e.fat_total     || 0), 0),
    workout_calories_burned: 0,
  } : null

  // Fetch today's session separately with explicit ordering
  let todaySession: any = null
  const activeProgram = activeProgramRes.data

  if (activeProgram) {
    // Get week 1 for this program
    const { data: weeks } = await supabase
      .from('program_weeks')
      .select('id')
      .eq('program_id', activeProgram.id)
      .order('week_number', { ascending: true })
      .limit(1)

    if (weeks && weeks.length > 0) {
      const { data: sessions } = await supabase
        .from('sessions')
        .select(`
          id, day_of_week, focus,
          session_exercises (
            id, order_index, target_sets, target_reps, rest_seconds,
            exercise:exercises ( id, name, muscle_group, gif_url )
          )
        `)
        .eq('program_week_id', weeks[0].id)
        .eq('day_of_week', dayOfWeek)
        .limit(1)

      todaySession = sessions?.[0] ?? null
    }
  }

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
      todayNutrition={todayNutrition as any}
      recentWeights={(weightsRes.data || []) as any}
      latestCheckin={(checkinRes.data?.[0] ?? null) as any}
      activeProgram={activeProgram ?? null}
      todaySession={todaySession as any}
      habits={habitsWithStatus}
    />
  )
}
