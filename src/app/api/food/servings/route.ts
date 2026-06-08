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

async function fetchFromFatSecret(fsId: string): Promise<ServingOption[]> {
  const data = await fatSecretPOST('food.get.v4', { food_id: fsId, include_food_images: 'false' })
  if (!data?.food?.servings?.serving) return []

  const raw: any[] = Array.isArray(data.food.servings.serving)
    ? data.food.servings.serving
    : [data.food.servings.serving]

  return raw
    .filter((s: any) => s.serving_description && parseFloat(s.calories || '0') >= 0)
    .map((s: any) => ({
      serving_id:  s.serving_id,
      description: s.serving_description,
      metric_g:    Math.round(parseFloat(s.metric_serving_amount || '100') * 10) / 10,
      calories:    Math.round(parseFloat(s.calories     || '0')),
      protein:     Math.round(parseFloat(s.protein      || '0') * 10) / 10,
      carbs:       Math.round(parseFloat(s.carbohydrate || '0') * 10) / 10,
      fat:         Math.round(parseFloat(s.fat          || '0') * 10) / 10,
      is_default:  s.is_default === '1' || s.is_default === 1,
    }))
}

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const fsIdParam  = request.nextUrl.searchParams.get('fs_food_id')
  const foodIdParam = request.nextUrl.searchParams.get('food_id')

  let fsId = fsIdParam || null

  if (foodIdParam) {
    const { data: food } = await supabase
      .from('foods').select('fs_food_id, servings_json').eq('id', foodIdParam).single()

    // Try cached servings_json first
    if (food?.servings_json) {
      try {
        const cached = JSON.parse(food.servings_json)
        if (Array.isArray(cached) && cached.length > 0) {
          return NextResponse.json({ servings: cached })
        }
      } catch { /* fall through */ }
    }

    if (food?.fs_food_id) fsId = food.fs_food_id
  }

  if (!fsId) return NextResponse.json({ servings: [] })

  const servings = await fetchFromFatSecret(fsId)

  // Cache back
  if (servings.length > 0 && foodIdParam) {
    supabase.from('foods')
      .update({ servings_json: JSON.stringify(servings) })
      .eq('id', foodIdParam)
      .then(() => null).catch(() => null)
  }

  return NextResponse.json({ servings })
}
