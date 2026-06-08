import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fatSecretPOST } from '@/lib/utils/fatsecret'

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const barcode = request.nextUrl.searchParams.get('barcode')
  if (!barcode) return NextResponse.json({ error: 'barcode required' }, { status: 400 })

  // Look up by barcode in FatSecret
  const data = await fatSecretPOST('food.find_id_for_barcode', { barcode })
  const fsId  = data?.food_id?.value

  if (!fsId) return NextResponse.json({ food: null })

  // Fetch full food data
  const foodData = await fatSecretPOST('food.get.v4', { food_id: fsId, include_food_images: 'false' })
  if (!foodData?.food) return NextResponse.json({ food: null })

  const f = foodData.food
  const servingsRaw = f.servings?.serving
  if (!servingsRaw) return NextResponse.json({ food: null })

  const allServings = Array.isArray(servingsRaw) ? servingsRaw : [servingsRaw]

  const defaultServing = allServings.find((s: any) => s.is_default === '1' || s.is_default === 1) || allServings[0]
  const per100 = allServings.find((s: any) =>
    parseFloat(s.metric_serving_amount || '0') === 100
  ) || defaultServing

  const grams = parseFloat(per100.metric_serving_amount || '100')
  const scale = 100 / (grams || 100)

  const servingOptions = allServings
    .filter((s: any) => parseFloat(s.metric_serving_amount || '0') > 0)
    .map((s: any) => ({
      serving_id:  s.serving_id,
      description: s.serving_description,
      metric_g:    Math.round(parseFloat(s.metric_serving_amount) * 10) / 10,
      calories:    Math.round(parseFloat(s.calories     || '0')),
      protein:     Math.round(parseFloat(s.protein      || '0') * 10) / 10,
      carbs:       Math.round(parseFloat(s.carbohydrate || '0') * 10) / 10,
      fat:         Math.round(parseFloat(s.fat          || '0') * 10) / 10,
      is_default:  s.is_default === '1' || s.is_default === 1,
    }))

  const food = {
    name:                (f.food_name || '').trim(),
    brand:               f.brand_name?.trim() || null,
    calories_per_100g:   Math.round(parseFloat(per100.calories     || '0') * scale),
    protein_per_100g:    Math.round(parseFloat(per100.protein      || '0') * scale * 10) / 10,
    carbs_per_100g:      Math.round(parseFloat(per100.carbohydrate || '0') * scale * 10) / 10,
    fat_per_100g:        Math.round(parseFloat(per100.fat          || '0') * scale * 10) / 10,
    serving_description: defaultServing?.serving_description || null,
    serving_calories:    defaultServing ? Math.round(parseFloat(defaultServing.calories || '0')) : null,
    serving_protein:     defaultServing ? Math.round(parseFloat(defaultServing.protein      || '0') * 10) / 10 : null,
    serving_carbs:       defaultServing ? Math.round(parseFloat(defaultServing.carbohydrate || '0') * 10) / 10 : null,
    serving_fat:         defaultServing ? Math.round(parseFloat(defaultServing.fat          || '0') * 10) / 10 : null,
    servings_json:       JSON.stringify(servingOptions),
    fs_food_id:          fsId,
    source:              'openfoodfacts',
    user_id:             null,
    barcode,
  }

  // Cache in DB
  supabase.from('foods').upsert(food, { onConflict: 'barcode' }).then(() => null).catch(() => null)

  return NextResponse.json({ food })
}
