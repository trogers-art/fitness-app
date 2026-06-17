import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('recent_foods')
    .select('id, food_name, food_brand, serving_desc, calories, protein_g, carbs_g, fat_g, quantity_g, meal_type, food_data, use_count, last_used_at')
    .eq('user_id', user.id)
    .order('last_used_at', { ascending: false })
    .limit(15)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ recent: data || [] })
}
