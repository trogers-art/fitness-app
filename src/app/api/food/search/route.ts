import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fatSecretPOST } from '@/lib/utils/fatsecret'

function parseFoodV5(f: any) {
  if (!f.food_name) return null

  const servingsRaw = f.servings?.serving
  if (!servingsRaw) return null

  const allServings = Array.isArray(servingsRaw) ? servingsRaw : [servingsRaw]

  // Default serving = is_default flag, else first non-100g, else first
  const defaultServing =
    allServings.find((s: any) => s.is_default === '1' || s.is_default === 1) ||
    allServings.find((s: any) => parseFloat(s.metric_serving_amount || '0') !== 100) ||
    allServings[0]

  // 100g reference for per-100g storage
  const per100 =
    allServings.find((s: any) => parseFloat(s.metric_serving_amount || '0') === 100) ||
    defaultServing

  if (!per100) return null

  const grams = parseFloat(per100.metric_serving_amount || '100')
  const scale = 100 / (grams || 100)
  const calories_per_100g = Math.round(parseFloat(per100.calories || '0') * scale)
  if (!calories_per_100g) return null

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

  return {
    barcode:             null,
    name:                f.food_name.trim(),
    brand:               f.brand_name?.trim() || null,
    calories_per_100g,
    protein_per_100g:    Math.round(parseFloat(per100.protein      || '0') * scale * 10) / 10,
    carbs_per_100g:      Math.round(parseFloat(per100.carbohydrate || '0') * scale * 10) / 10,
    fat_per_100g:        Math.round(parseFloat(per100.fat          || '0') * scale * 10) / 10,
    fibre_per_100g:      per100.fiber ? Math.round(parseFloat(per100.fiber) * scale * 10) / 10 : null,
    serving_size_g:      defaultServing ? Math.round(parseFloat(defaultServing.metric_serving_amount) * 10) / 10 : null,
    serving_description: defaultServing?.serving_description || null,
    serving_calories:    defaultServing ? Math.round(parseFloat(defaultServing.calories || '0')) : null,
    serving_protein:     defaultServing ? Math.round(parseFloat(defaultServing.protein      || '0') * 10) / 10 : null,
    serving_carbs:       defaultServing ? Math.round(parseFloat(defaultServing.carbohydrate || '0') * 10) / 10 : null,
    serving_fat:         defaultServing ? Math.round(parseFloat(defaultServing.fat          || '0') * 10) / 10 : null,
    servings_json:       JSON.stringify(servingOptions),
    fs_food_id:          f.food_id?.toString() || null,
    source:              'openfoodfacts' as const,
    user_id:             null,
  }
}

async function searchFatSecret(query: string) {
  const data = await fatSecretPOST('foods.search.v5', {
    search_expression:    query,
    max_results:          '10',
    page_number:          '0',
    flag_default_serving: 'true',
    format:               'json',
    region:               'US',
    language:             'en',
  })

  // v5 response structure: foods_search.results.food[]
  const results = data?.foods_search?.results?.food
  if (!results) return []
  const list = Array.isArray(results) ? results : [results]
  return list.map(parseFoodV5).filter(Boolean)
}

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = request.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ foods: [] })

  // 1. Local cache — only use if complete (has fs_food_id + serving data)
  const { data: localFoods } = await supabase
    .from('foods').select('*')
    .or(`user_id.is.null,user_id.eq.${user.id}`)
    .ilike('name', `%${q}%`)
    .order('name').limit(10)

  if (
    localFoods &&
    localFoods.length >= 6 &&
    localFoods.every((f: any) => f.fs_food_id && f.serving_description)
  ) {
    return NextResponse.json({ foods: sortByRelevance(localFoods, q) })
  }

  // 2. FatSecret v5
  const external = await searchFatSecret(q)

  // 3. Cache — store new, backfill stale
  if (external.length > 0) {
    const toStore = external.map(({ servings_json, ...f }: any) => f)
    supabase.from('foods').insert(toStore).then(() => null, () => null)
    for (const food of toStore) {
      if (food.fs_food_id && food.name) {
        supabase.from('foods')
          .update({ fs_food_id: food.fs_food_id, serving_description: food.serving_description, serving_calories: food.serving_calories, serving_size_g: food.serving_size_g })
          .ilike('name', food.name).is('user_id', null).is('fs_food_id', null)
          .then(() => null, () => null)
      }
    }
  }

  // 4. Merge + dedupe
  const seen = new Set<string>()
  const merged = [...(localFoods || []), ...external].filter((f: any) => {
    const key = f.name.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return NextResponse.json({ foods: sortByRelevance(merged, q).slice(0, 20) })
}

function sortByRelevance(foods: any[], q: string) {
  const ql = q.toLowerCase()
  return [...foods].sort((a, b) => {
    const al = a.name.toLowerCase()
    const bl = b.name.toLowerCase()
    if (al === ql && bl !== ql) return -1
    if (bl === ql && al !== ql) return 1
    if (al.startsWith(ql) && !bl.startsWith(ql)) return -1
    if (bl.startsWith(ql) && !al.startsWith(ql)) return 1
    if (a.serving_description && !b.serving_description) return -1
    if (b.serving_description && !a.serving_description) return 1
    return al.length - bl.length
  })
}
