import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date().toISOString().split('T')[0]

  const [profileRes, nutritionRes, bodyRes, checkinsRes] = await Promise.all([
    supabase.from('user_profiles').select('*').eq('user_id', user.id).single(),
    supabase.from('daily_nutrition_summaries').select('*').eq('user_id', user.id).eq('date', today).single(),
    supabase.from('body_metrics').select('weight_kg, logged_at').eq('user_id', user.id).order('logged_at', { ascending: false }).limit(14),
    supabase.from('checkin_logs').select('explanation, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1),
  ])

  return (
    <DashboardClient
      profile={profileRes.data}
      todayNutrition={nutritionRes.data}
      recentWeights={bodyRes.data || []}
      latestCheckin={checkinsRes.data?.[0] || null}
    />
  )
}
