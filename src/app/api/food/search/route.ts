import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fatSecretPOST } from '@/lib/utils/fatsecret'

async function searchFatSecret(query: string) {
  const data = await fatSecretPOST('foods.search', {
    search_expression:  query,
    max_results:        '10',
    page_number:        '0',
    flag_default_serving: 'true',
  })

  if (!data?.foods?.food) return []

  const list = Array.isArray(data.foods.food) ? data.foods.food : [data.foods.food]

  return list
    .filter((f: any) => f.food_name && f.servings?.serving)
    .map((f: any) => {
      const servingsRaw = f.servings.serving
      const allServings = Array.isArray(servingsRaw) ? servingsRaw : [servingsRaw]

      // Find default serving, then first non-100g, then 100g fallback
      const defaultServing = allServings.find((s: any) => s.is_default === '1' || s.is_default === 1)
        || allServings.find((s: any) => parseFloat(s.metric_serving_amount || '0') !== 100 && s.metric_serving_unit === 'g')
        || allServings.find((s: any) => s.metric_serving_unit === 'g')
        || allServings[0]

      // Get 100g serving for per-100g storage
      const per100 = allServings.find((s: any) =>
        parseFloat(s.metric_serving_amount || '0') === 100 && s.metric_serving_unit === 'g'
      ) || defaultServing

      if (!per100 || !parseFloat(per100.calories)) return null

      const g100  = parseFloat(per100.metric_serving_amount || '100')
      const scale = 100 / g100

      // Build serving options array for the detail view
      const servingOptions = allServings
        .filter((s: any) => s.metric_serving_unit === 'g' && parseFloat(s.metric_serving_amount || '0') > 0)
        .map((s: any) => ({
          serving_id:  s.serving_id,
          description: s.serving_description,
          metric_g:    Math.round(parseFloat(s.metric_serving_amount) * 10) / 10,
          calories:    Math.round(parseFloat(s.calories)),
          protein:     Math.round(parseFloat(s.protein)      * 10) / 10,
          carbs:       Math.round(parseFloat(s.carbohydrate)  * 10) / 10,
          fat:         Math.round(parseFloat(s.fat)           * 10) / 10,
          is_default:  s.is_default === '1' || s.is_default === 1,
        }))

      return {
        barcode:           null,
        name:              f.food_name.trim(),
        brand:             f.brand_name?.trim() || null,
        calories_per_100g: Math.round(parseFloat(per100.calories)      * scale),
        protein_per_100g:  Math.round(parseFloat(per100.protein)        * scale * 10) / 10,
        carbs_per_100g:    Math.round(parseFloat(per100.carbohydrate)   * scale * 10) / 10,
        fat_per_100g:      Math.round(parseFloat(per100.fat)            * scale * 10) / 10,
        fibre_per_100g:    per100.fiber ? Math.round(parseFloat(per100.fiber) * scale * 10) / 10 : null,
        // Default serving for display in search results list
        serving_size_g:    defaultServing ? Math.round(parseFloat(defaultServing.metric_serving_amount) * 10) / 10 : null,
        serving_description: defaultServing?.serving_description || null,
        serving_calories:  defaultServing ? Math.round(parseFloat(defaultServing.calories)) : null,
        serving_protein:   defaultServing ? Math.round(parseFloat(defaultServing.protein) * 10) / 10 : null,
        serving_carbs:     defaultServing ? Math.round(parseFloat(defaultServing.carbohydrate) * 10) / 10 : null,
        serving_fat:       defaultServing ? Math.round(parseFloat(defaultServing.fat) * 10) / 10 : null,
        // Full servings list embedded — no follow-up food.get needed
        servings_json:     JSON.stringify(servingOptions),
        fs_food_id:        f.food_id?.toString() || null,
        source:            'openfoodfacts' as const,
        user_id:           null,
      }
    })
    .filter(Boolean)
}

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = request.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ foods: [] })

  // 1. Local cache
  const { data: localFoods } = await supabase
    .from('foods').select('*')
    .or(`user_id.is.null,user_id.eq.${user.id}`)
    .ilike('name', `%${q}%`)
    .order('name').limit(10)

  // Only use cache if foods have fs_food_id (so servings work)
  if (localFoods && localFoods.length >= 6 && localFoods.every((f: any) => f.fs_food_id)) {
    return NextResponse.json({ foods: sortByRelevance(localFoods, q) })
  }

  // 2. FatSecret search.v2
  const external = (await searchFatSecret(q)).filter(Boolean)

  // 3. Cache best-effort
  if (external.length > 0) {
    const toStore = external.map(({ servings_json, serving_description, serving_calories, serving_protein, serving_carbs, serving_fat, ...f }: any) => f)
    supabase.from('foods').insert(toStore).then(() => null).catch(() => null)
  }

  // 4. Merge and return (include full servings_json for client)
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
