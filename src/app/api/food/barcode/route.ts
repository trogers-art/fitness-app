import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface OFFProduct {
  status: number
  product?: {
    product_name?: string
    brands?: string
    nutriments?: {
      'energy-kcal_100g'?: number
      'proteins_100g'?: number
      'carbohydrates_100g'?: number
      'fat_100g'?: number
      'fiber_100g'?: number
      'sugars_100g'?: number
      'sodium_100g'?: number
    }
  }
}

async function lookupOpenFoodFacts(barcode: string) {
  const res = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`,
    { next: { revalidate: 86400 } }   // cache 24h
  )
  if (!res.ok) return null
  const data: OFFProduct = await res.json()
  if (data.status !== 1 || !data.product) return null

  const n = data.product.nutriments
  if (!n || n['energy-kcal_100g'] == null) return null

  return {
    barcode,
    name: data.product.product_name || 'Unknown',
    brand: data.product.brands || null,
    calories_per_100g: Math.round(n['energy-kcal_100g'] ?? 0),
    protein_per_100g: Math.round((n['proteins_100g'] ?? 0) * 10) / 10,
    carbs_per_100g: Math.round((n['carbohydrates_100g'] ?? 0) * 10) / 10,
    fat_per_100g: Math.round((n['fat_100g'] ?? 0) * 10) / 10,
    fibre_per_100g: n['fiber_100g'] != null ? Math.round(n['fiber_100g'] * 10) / 10 : null,
    sugar_per_100g: n['sugars_100g'] != null ? Math.round(n['sugars_100g'] * 10) / 10 : null,
    sodium_per_100g: n['sodium_100g'] != null ? Math.round(n['sodium_100g'] * 1000) / 1000 : null,
    source: 'openfoodfacts' as const,
  }
}

async function lookupUSDA(barcode: string) {
  const apiKey = process.env.USDA_API_KEY
  if (!apiKey) return null

  const res = await fetch(
    `https://api.nal.usda.gov/fdc/v1/foods/search?query=${barcode}&api_key=${apiKey}&pageSize=1`,
    { next: { revalidate: 86400 } }
  )
  if (!res.ok) return null
  const data = await res.json()
  const food = data.foods?.[0]
  if (!food) return null

  const getNutrient = (nutrients: { nutrientId: number; value: number }[], id: number) =>
    nutrients.find(n => n.nutrientId === id)?.value ?? 0

  return {
    barcode,
    name: food.description || 'Unknown',
    brand: food.brandOwner || null,
    calories_per_100g: Math.round(getNutrient(food.foodNutrients, 1008)),
    protein_per_100g: Math.round(getNutrient(food.foodNutrients, 1003) * 10) / 10,
    carbs_per_100g: Math.round(getNutrient(food.foodNutrients, 1005) * 10) / 10,
    fat_per_100g: Math.round(getNutrient(food.foodNutrients, 1004) * 10) / 10,
    fibre_per_100g: Math.round(getNutrient(food.foodNutrients, 1079) * 10) / 10 || null,
    sugar_per_100g: Math.round(getNutrient(food.foodNutrients, 2000) * 10) / 10 || null,
    sodium_per_100g: null,
    source: 'usda' as const,
  }
}

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const barcode = request.nextUrl.searchParams.get('barcode')
  if (!barcode) return NextResponse.json({ error: 'barcode param required' }, { status: 400 })

  // 1. Check our foods table first (cached results)
  const { data: cached } = await supabase
    .from('foods')
    .select('*')
    .eq('barcode', barcode)
    .is('user_id', null)   // global foods only
    .limit(1)
    .single()

  if (cached) return NextResponse.json({ food: cached, source: 'cache' })

  // 2. Open Food Facts
  const offResult = await lookupOpenFoodFacts(barcode)
  if (offResult) {
    // Cache in our DB
    const { data: saved } = await supabase
      .from('foods')
      .insert({ ...offResult, user_id: null })
      .select()
      .single()
    return NextResponse.json({ food: saved || offResult, source: 'openfoodfacts' })
  }

  // 3. USDA fallback
  const usdaResult = await lookupUSDA(barcode)
  if (usdaResult) {
    const { data: saved } = await supabase
      .from('foods')
      .insert({ ...usdaResult, user_id: null })
      .select()
      .single()
    return NextResponse.json({ food: saved || usdaResult, source: 'usda' })
  }

  // 4. Not found — prompt manual entry
  return NextResponse.json({ food: null, source: 'not_found' }, { status: 404 })
}
