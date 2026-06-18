import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get profile including timezone
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('daily_calories, protein_g, carbs_g, fat_g, units, goal, timezone')
    .eq('user_id', user.id).single()

  const tz = profile?.timezone || 'UTC'

  // Compute today's date in the user's local timezone
  const now   = new Date()
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now) // YYYY-MM-DD

  // Get day of week in user's timezone (0=Sun, 1=Mon ... 6=Sat)
  // Use numeric weekday: Sunday=0 ... Saturday=6
  const localDayNum = parseInt(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(now) === 'Sunday'    ? '0' :
    new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(now) === 'Monday'    ? '1' :
    new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(now) === 'Tuesday'   ? '2' :
    new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(now) === 'Wednesday' ? '3' :
    new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(now) === 'Thursday'  ? '4' :
    new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(now) === 'Friday'    ? '5' : '6'
  )
  // Schema: 1=Mon ... 7=Sun
  const dayOfWeek = localDayNum === 0 ? 7 : localDayNum

  const [weightsRes, checkinRes, activeProgramRes, habitsRes, habitLogsRes, entriesRes] = await Promise.all([
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

    // Food entries for today in user's timezone using date cast
    supabase.from('food_entries')
      .select('calories_total, protein_total, carbs_total, fat_total, logged_at')
      .eq('user_id', user.id),
  ])

  // Filter entries client-side by user's local date to avoid timezone DB issues
  const allEntries = entriesRes.data || []
  const todayEntries = allEntries.filter(e => {
    if (!e.logged_at) return false
    const entryDate = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(e.logged_at))
    return entryDate === today
  })

  const todayNutrition = todayEntries.length > 0 ? {
    total_calories:          Math.round(todayEntries.reduce((s, e) => s + (e.calories_total || 0), 0)),
    protein_g:               Math.round(todayEntries.reduce((s, e) => s + (e.protein_total || 0), 0) * 10) / 10,
    carbs_g:                 Math.round(todayEntries.reduce((s, e) => s + (e.carbs_total   || 0), 0) * 10) / 10,
    fat_g:                   Math.round(todayEntries.reduce((s, e) => s + (e.fat_total     || 0), 0) * 10) / 10,
    workout_calories_burned: 0,
  } : null

  // Fetch today's session
  let todaySession: any = null
  const activeProgram = activeProgramRes.data

  if (activeProgram) {
    const { data: weeks } = await supabase
      .from('program_weeks')
      .select('id, week_number')
      .eq('program_id', activeProgram.id)
      .order('week_number', { ascending: true })
      .limit(1)

    const weekId = weeks?.[0]?.id
    if (weekId) {
      const { data: sessions } = await supabase
        .from('sessions')
        .select(`
          id, day_of_week, focus,
          session_exercises (
            id, order_index, target_sets, target_reps, rest_seconds,
            exercise:exercises ( id, name, muscle_group, gif_url )
          )
        `)
        .eq('program_week_id', weekId)
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
      profile={profile as any}
      emailConfirmed={!!user.email_confirmed_at}
      userEmail={user.email ?? ''}
      todayNutrition={todayNutrition as any}
      recentWeights={(weightsRes.data || []) as any}
      latestCheckin={(checkinRes.data?.[0] ?? null) as any}
      activeProgram={activeProgram ?? null}
      todaySession={todaySession}
      habits={habitsWithStatus}
      timezone={tz}
      today={today}
    />
  )
}
