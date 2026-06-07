import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fatSecretPOST } from '@/lib/utils/fatsecret'

// Parse FatSecret v1 food_description string
// Format: "Per 1 mug (8 fl oz) - Calories: 2kcal | Fat: 0.05g | Carbs: 0g | Protein: 0.28g"
// Format: "Per 100g - Calories: 89kcal | Fat: 0.33g | Carbs: 22.84g | Protein: 1.09g"
// Format: "Per 1 medium banana (7" to 7-7/8" long) - Calories: 105kcal | ..."
function parseDescription(desc: string) {
  const cal  = desc.match(/Calories:\s*([\d.]+)kcal/i)?.[1]
  const fat  = desc.match(/Fat:\s*([\d.]+)g/i)?.[1]
  const carb = desc.match(/Carbs:\s*([\d.]+)g/i)?.[1]
  const prot = desc.match(/Protein:\s*([\d.]+)g/i)?.[1]
  if (!cal) return null

  // Extract the "Per X" part — everything between "Per " and " - Calories"
  const perMatch = desc.match(/^Per\s+(.+?)\s*-\s*Calories/i)
  const perPart  = perMatch?.[1]?.trim() || ''

  // Check if it's per 100g/ml (reference portion — not a real serving)
  const isPer100 = /^100\s*(g|ml|gram)/i.test(perPart)

  // Try to extract gram amount from perPart e.g. "168g" or "1 mug (8 fl oz)"
  const gramMatch = perPart.match(/^([\d.]+)\s*(g|gram)/i)
  const serving_size_g = gramMatch ? Math.round(parseFloat(gramMatch[1]) * 10) / 10 : null

  const calories = parseFloat(cal)
  const factor   = serving_size_g && !isPer100 ? serving_size_g / 100 : 1

  return {
    // Always store per-100g
    calories_per_100g: Math.round(calories / factor),
    protein_per_100g:  Math.round(parseFloat(prot || '0') / factor * 10) / 10,
    carbs_per_100g:    Math.round(parseFloat(carb || '0') / factor * 10) / 10,
    fat_per_100g:      Math.round(parseFloat(fat  || '0') / factor * 10) / 10,
    // Default serving for display in the list
    serving_size_g:    isPer100 ? null : serving_size_g,
    // The human-readable serving label shown in the list — "1 mug (8 fl oz)" or "1 medium"
    serving_label:     isPer100 ? null : perPart,
    // Calories for the default serving (what to show in the list)
    serving_calories:  isPer100 ? null : Math.round(calories),
    serving_protein:   isPer100 ? null : Math.round(parseFloat(prot || '0') * 10) / 10,
    serving_carbs:     isPer100 ? null : Math.round(parseFloat(carb || '0') * 10) / 10,
    serving_fat:       isPer100 ? null : Math.round(parseFloat(fat  || '0') * 10) / 10,
  }
}

async function searchFatSecret(query: string) {
  const data = await fatSecretPOST('foods.search', {
    search_expression: query,
    max_results:       '10',
    page_number:       '0',
  })

  if (!data?.foods?.food) return []

  const list = Array.isArray(data.foods.food) ? data.foods.food : [data.foods.food]

  return list
    .filter((f: any) => f.food_name && f.food_description)
    .map((f: any) => {
      const parsed = parseDescription(f.food_description)
      if (!parsed) return null

      return {
        barcode:             null,
        name:                f.food_name.trim(),
        brand:               f.brand_name?.trim() || null,
        calories_per_100g:   parsed.calories_per_100g,
        protein_per_100g:    parsed.protein_per_100g,
        carbs_per_100g:      parsed.carbs_per_100g,
        fat_per_100g:        parsed.fat_per_100g,
        fibre_per_100g:      null,
        serving_size_g:      parsed.serving_size_g,
        serving_description: parsed.serving_label,
        serving_calories:    parsed.serving_calories,
        serving_protein:     parsed.serving_protein,
        serving_carbs:       parsed.serving_carbs,
        serving_fat:         parsed.serving_fat,
        fs_food_id:          f.food_id?.toString() || null,
        source:              'openfoodfacts' as const,
        user_id:             null,
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

  // 1. Local cache — only use if foods have fs_food_id
  const { data: localFoods } = await supabase
    .from('foods').select('*')
    .or(`user_id.is.null,user_id.eq.${user.id}`)
    .ilike('name', `%${q}%`)
    .order('name').limit(10)

  // Use cache if all foods have fs_food_id — otherwise re-fetch to backfill
  if (localFoods && localFoods.length >= 6 && localFoods.every((f: any) => f.fs_food_id)) {
    return NextResponse.json({ foods: sortByRelevance(localFoods, q) })
  }

  // 2. FatSecret
  const external = (await searchFatSecret(q)).filter(Boolean)

  // 3. Cache best-effort — insert new, update existing with fs_food_id
  if (external.length > 0) {
    const toStore = external.map(({ serving_label, ...f }: any) => f)
    // Try insert first, then update fs_food_id on existing rows
    supabase.from('foods').insert(toStore).then(() => null).catch(() => null)
    // Backfill fs_food_id on stale cached rows
    for (const food of toStore) {
      if (food.fs_food_id && food.name) {
        supabase.from('foods')
          .update({ fs_food_id: food.fs_food_id, serving_description: food.serving_description, serving_calories: food.serving_calories, serving_size_g: food.serving_size_g })
          .ilike('name', food.name)
          .is('user_id', null)
          .is('fs_food_id', null)
          .then(() => null).catch(() => null)
      }
    }
  }

  // 4. Merge local + external, dedupe
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
    // Prefer results with a real serving description
    if (a.serving_description && !b.serving_description) return -1
    if (b.serving_description && !a.serving_description) return 1
    return al.length - bl.length
  })
}
