import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BodyClient from './BodyClient'

export default async function BodyPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('units, goal, weight_kg, target_weight_kg, daily_calories')
    .eq('user_id', user.id)
    .single()

  // Last 90 days of metrics
  const since = new Date()
  since.setDate(since.getDate() - 90)

  const { data: metrics } = await supabase
    .from('body_metrics')
    .select('id, weight_kg, waist_cm, hips_cm, chest_cm, arms_cm, thighs_cm, logged_at, notes')
    .eq('user_id', user.id)
    .gte('logged_at', since.toISOString())
    .order('logged_at', { ascending: false })

  return (
    <BodyClient
      profile={profile}
      initialMetrics={metrics || []}
    />
  )
}
