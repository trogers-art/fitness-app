import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import FoodDiary from './FoodDiary'

export default async function FoodPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('daily_calories, protein_g, carbs_g, fat_g, units')
    .eq('user_id', user.id)
    .single()

  return <FoodDiary profile={profile} />
}
