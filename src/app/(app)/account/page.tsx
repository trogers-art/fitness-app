import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AccountClient from './AccountClient'

export default async function AccountPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('goal, units, daily_calories, protein_g, carbs_g, fat_g, bmr, tdee, weight_kg, height_cm, age, sex, activity_level')
    .eq('user_id', user.id)
    .single()

  return <AccountClient email={user.email ?? ''} emailConfirmed={!!user.email_confirmed_at} profile={profile} />
}
