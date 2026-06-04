import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ── Open Food Facts ────────────────────────────────────────────────────────

async function searchOFF(query: string) {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&json=1&page_size=8&fields=id,product_name,brands,nutriments`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return []
    const data = await res.json()
    return (data.products || [])
      .filter((p: any) => p.product_name && p.nutriments?.['energy-kcal_100g'] != null)
      .map((p: any) => ({
        barcode: null,
        name: p.product_name.trim(),
        brand: p.brands?.split(',')[0]?.trim() || null,
        calories_per_100g: Math.round(p.nutriments['energy-kcal_100g'] ?? 0),
        protein_per_100g:  Math.round((p.nutriments['proteins_100g'] ?? 0) * 10) / 10,
        carbs_per_100g:    Math.round((p.nutriments['carbohydrates_100g'] ?? 0) * 10) / 10,
        fat_per_100g:      Math.round((p.nutriments['fat_100g'] ?? 0) * 10) / 10,
        fibre_per_100g:    p.nutriments['fiber_100g'] != null ? Math.round(p.nutriments['fiber_100g'] * 10) / 10 : null,
        serving_size_g: p.nutriments['serving_size'] != null
          ? Math.round(parseFloat(p.nutriments['serving_size']) * 10) / 10
          : (p.serving_size != null ? Math.round(parseFloat(p.serving_size) * 10) / 10 : null),
        source: 'openfoodfacts' as const,
        user_id: null,
      }))
  } catch { return [] }
}

// ── USDA FoodData Central ──────────────────────────────────────────────────

async function searchUSDA(query: string) {
  const apiKey = process.env.USDA_API_KEY
  if (!apiKey) return []
  try {
    const res = await fetch(
      `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&api_key=${apiKey}&pageSize=8&dataType=SR%20Legacy,Foundation`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return []
    const data = await res.json()

    const getNutrient = (nutrients: any[], id: number) =>
      nutrients.find((n: any) => n.nutrientId === id)?.value ?? 0

    return (data.foods || [])
      .filter((f: any) => f.description && getNutrient(f.foodNutrients, 1008) > 0)
      .map((f: any) => ({
        barcode: null,
        name: f.description
          .split(',')[0]           // "Banana, raw" → "Banana"
          .trim()
          .replace(/\b\w/g, (c: string) => c.toUpperCase()), // title case
        brand: null,
        calories_per_100g: Math.round(getNutrient(f.foodNutrients, 1008)),
        protein_per_100g:  Math.round(getNutrient(f.foodNutrients, 1003) * 10) / 10,
        carbs_per_100g:    Math.round(getNutrient(f.foodNutrients, 1005) * 10) / 10,
        fat_per_100g:      Math.round(getNutrient(f.foodNutrients, 1004) * 10) / 10,
        fibre_per_100g:    Math.round(getNutrient(f.foodNutrients, 1079) * 10) / 10 || null,
        serving_size_g: f.servingSize != null ? Math.round(f.servingSize * 10) / 10 : null,
        source: 'usda' as const,
        user_id: null,
      }))
  } catch { return [] }
}

// ── Route ──────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = request.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ foods: [] })

  // 1. Local DB first
  const { data: localFoods } = await supabase
    .from('foods')
    .select('*')
    .or(`user_id.is.null,user_id.eq.${user.id}`)
    .ilike('name', `%${q}%`)
    .order('name')
    .limit(10)

  if (localFoods && localFoods.length >= 8) {
    return NextResponse.json({ foods: sortByRelevance(localFoods, q) })
  }

  // 2. Hit USDA + OFF in parallel
  const [usdaResults, offResults] = await Promise.all([
    searchUSDA(q),
    searchOFF(q),
  ])

  // 3. USDA first (more reliable for staples), then OFF
  const external = [...usdaResults, ...offResults]

  // 4. Cache to DB
  if (external.length > 0) {
    await supabase
      .from('foods')
      .upsert(external, { onConflict: 'name', ignoreDuplicates: true })
  }

  // 5. Merge, dedupe, sort
  const seen = new Set<string>()
  const merged = [...(localFoods || []), ...external].filter(f => {
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
    // Prefer USDA (clean staples) over OFF (packaged goods)
    if (a.source === 'usda' && b.source !== 'usda') return -1
    if (b.source === 'usda' && a.source !== 'usda') return 1
    return al.length - bl.length
  })
}
