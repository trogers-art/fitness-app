import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BodyClient from './BodyClient'

export const dynamic = 'force-dynamic'

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
    .select('id, weight_kg, waist_cm, hips_cm, chest_cm, arms_cm, thighs_cm, logged_at, note')
    .eq('user_id', user.id)
    .gte('logged_at', since.toISOString())
    .order('logged_at', { ascending: false })

  // Map DB column "note" to the "notes" field BodyClient expects
  const mappedMetrics = (metrics || []).map(m => ({
    ...m,
    notes: m.note,
  }))

  return (
    <BodyClient
      profile={profile}
      initialMetrics={mappedMetrics}
    />
  )
}
