import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fatSecretPOST } from '@/lib/utils/fatsecret'

export interface ServingOption {
  serving_id:  string
  description: string
  metric_g:    number
  calories:    number
  protein:     number
  carbs:       number
  fat:         number
  is_default:  boolean
}

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const fsId   = request.nextUrl.searchParams.get('fs_food_id')
  const foodId = request.nextUrl.searchParams.get('food_id')

  // Try cached servings_json from DB first
  if (foodId) {
    const { data: food } = await supabase
      .from('foods').select('servings_json').eq('id', foodId).single()
    if (food?.servings_json) {
      try {
        const servings = JSON.parse(food.servings_json)
        if (Array.isArray(servings) && servings.length > 0) {
          return NextResponse.json({ servings })
        }
      } catch { /* fall through to API */ }
    }
  }

  if (!fsId) return NextResponse.json({ servings: [] })

  // Fall back to food.get.v4
  const data = await fatSecretPOST('food.get.v4', { food_id: fsId })
  if (!data?.food?.servings?.serving) return NextResponse.json({ servings: [] })

  const raw: any[] = Array.isArray(data.food.servings.serving)
    ? data.food.servings.serving
    : [data.food.servings.serving]

  const servings: ServingOption[] = raw
    .filter(s => s.metric_serving_unit === 'g' && parseFloat(s.metric_serving_amount || '0') > 0)
    .map(s => ({
      serving_id:  s.serving_id,
      description: s.serving_description,
      metric_g:    Math.round(parseFloat(s.metric_serving_amount) * 10) / 10,
      calories:    Math.round(parseFloat(s.calories)),
      protein:     Math.round(parseFloat(s.protein)      * 10) / 10,
      carbs:       Math.round(parseFloat(s.carbohydrate)  * 10) / 10,
      fat:         Math.round(parseFloat(s.fat)           * 10) / 10,
      is_default:  s.is_default === '1' || s.is_default === 1,
    }))

  return NextResponse.json({ servings })
}
