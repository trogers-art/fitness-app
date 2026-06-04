import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import FoodDiary from './FoodDiary'

export default async function FoodPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date().toISOString().split('T')[0]

  const [profileRes, entriesRes] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('daily_calories, protein_g, carbs_g, fat_g, units')
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('food_entries')
      .select(`
        id, meal_type, quantity_g, logged_at,
        food:foods ( id, name, brand, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g )
      `)
      .eq('user_id', user.id)
      .gte('logged_at', `${today}T00:00:00`)
      .lte('logged_at', `${today}T23:59:59`)
      .order('logged_at', { ascending: true }),
  ])

  return (
    <FoodDiary
      profile={profileRes.data}
      entries={entriesRes.data || []}
      today={today}
    />
  )
}
