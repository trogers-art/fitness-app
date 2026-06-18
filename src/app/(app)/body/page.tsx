import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BodyClient from './BodyClient'

export const dynamic = 'force-dynamic'

export default async function BodyPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  console.log('[body-page] user.id:', user.id)

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('units, goal, weight_kg, target_weight_kg, daily_calories')
    .eq('user_id', user.id)
    .single()

  if (profileError) console.error('[body-page] profile error:', profileError)

  // Last 90 days of metrics
  const since = new Date()
  since.setDate(since.getDate() - 90)

  console.log('[body-page] since:', since.toISOString())

  const { data: metrics, error: metricsError } = await supabase
    .from('body_metrics')
    .select('id, weight_kg, waist_cm, hips_cm, chest_cm, arms_cm, thighs_cm, logged_at, notes')
    .eq('user_id', user.id)
    .gte('logged_at', since.toISOString())
    .order('logged_at', { ascending: false })

  console.log('[body-page] metrics count:', metrics?.length ?? 0)
  if (metricsError) console.error('[body-page] metrics error:', metricsError)

  return (
    <BodyClient
      profile={profile}
      initialMetrics={metrics || []}
    />
  )
}
