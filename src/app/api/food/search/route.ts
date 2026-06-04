import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'

// ── FatSecret OAuth 1.0 ───────────────────────────────────────────────────

function sign(method: string, url: string, params: Record<string, string>, secret: string): string {
  const normalized = Object.keys(params)
    .sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join('&')
  const base = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(normalized)}`
  const key  = `${encodeURIComponent(secret)}&`
  return crypto.createHmac('sha1', key).update(base).digest('base64')
}

async function fatSecretPOST(methodName: string, extra: Record<string, string>): Promise<any> {
  const key    = process.env.FATSECRET_CONSUMER_KEY?.trim()
  const secret = process.env.FATSECRET_CONSUMER_SECRET?.trim()
  if (!key || !secret) return null

  const url = 'https://platform.fatsecret.com/rest/server.api'
  const params: Record<string, string> = {
    method: methodName, format: 'json',
    oauth_consumer_key: key,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: '1.0',
    ...extra,
  }
  params.oauth_signature = sign('POST', url, params, secret)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
    })
    const data = await res.json()
    if (data.error) { console.error('[FS] error:', data.error); return null }
    return data
  } catch (e) {
    console.error('[FS] request error:', e)
    return null
  }
}

// ── Get full food detail (for branded/serving-based foods) ────────────────

interface FSServing {
  serving_description: string
  metric_serving_amount?: string
  metric_serving_unit?: string
  calories: string
  carbohydrate: string
  protein: string
  fat: string
  fiber?: string
}

async function getFoodDetail(foodId: string): Promise<{
  calories_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
  fibre_per_100g: number | null
  serving_size_g: number | null
} | null> {
  const data = await fatSecretPOST('food.get.v4', { food_id: foodId, format: 'json' })
  if (!data?.food?.servings?.serving) return null

  const servings: FSServing[] = Array.isArray(data.food.servings.serving)
    ? data.food.servings.serving
    : [data.food.servings.serving]

  // Prefer explicit 100g serving if available
  const per100 = servings.find(s =>
    s.serving_description.toLowerCase().includes('100g') ||
    s.serving_description.toLowerCase().includes('100 g') ||
    (s.metric_serving_amount === '100' && s.metric_serving_unit === 'g')
  )

  if (per100) {
    return {
      calories_per_100g: Math.round(parseFloat(per100.calories)),
      protein_per_100g:  Math.round(parseFloat(per100.protein)     * 10) / 10,
      carbs_per_100g:    Math.round(parseFloat(per100.carbohydrate) * 10) / 10,
      fat_per_100g:      Math.round(parseFloat(per100.fat)          * 10) / 10,
      fibre_per_100g:    per100.fiber ? Math.round(parseFloat(per100.fiber) * 10) / 10 : null,
      serving_size_g:    null,
    }
  }

  // Otherwise use first serving with a gram measurement and normalise to 100g
  const withGrams = servings.find(s =>
    s.metric_serving_unit === 'g' &&
    s.metric_serving_amount &&
    parseFloat(s.metric_serving_amount) > 0
  )

  if (withGrams) {
    const g = parseFloat(withGrams.metric_serving_amount!)
    const factor = 100 / g
    return {
      calories_per_100g: Math.round(parseFloat(withGrams.calories)       * factor),
      protein_per_100g:  Math.round(parseFloat(withGrams.protein)         * factor * 10) / 10,
      carbs_per_100g:    Math.round(parseFloat(withGrams.carbohydrate)    * factor * 10) / 10,
      fat_per_100g:      Math.round(parseFloat(withGrams.fat)             * factor * 10) / 10,
      fibre_per_100g:    withGrams.fiber
        ? Math.round(parseFloat(withGrams.fiber) * factor * 10) / 10
        : null,
      serving_size_g: Math.round(g * 10) / 10,
    }
  }

  return null
}

// ── Search ────────────────────────────────────────────────────────────────

async function searchFatSecret(query: string) {
  const data = await fatSecretPOST('foods.search', {
    search_expression: query,
    max_results: '10',
    page_number: '0',
  })

  if (!data?.foods?.food) return []

  const list = Array.isArray(data.foods.food) ? data.foods.food : [data.foods.food]

  const results = await Promise.all(
    list
      .filter((f: any) => f.food_description && f.food_name)
      .map(async (f: any) => {
        const desc      = f.food_description as string
        const isBranded = f.food_type === 'Brand'

        // Check if description is per 100g
        const isPer100g   = /per\s+100\s*g/i.test(desc)
        const gramMatch   = desc.match(/per\s+([\d.]+)\s*g/i)
        const servingGram = gramMatch ? parseFloat(gramMatch[1]) : null

        const calMatch  = desc.match(/Calories:\s*([\d.]+)kcal/i)
        const fatMatch  = desc.match(/Fat:\s*([\d.]+)g/i)
        const carbMatch = desc.match(/Carbs:\s*([\d.]+)g/i)
        const protMatch = desc.match(/Protein:\s*([\d.]+)g/i)

        if (!calMatch) return null

        let calories = parseFloat(calMatch[1])
        let fat      = parseFloat(fatMatch?.[1]  || '0')
        let carbs    = parseFloat(carbMatch?.[1] || '0')
        let protein  = parseFloat(protMatch?.[1] || '0')
        let serving_size_g: number | null = null
        let fibre_per_100g: number | null = null

        if (isPer100g) {
          // Already per 100g — use as-is
        } else if (servingGram && servingGram !== 100) {
          // Known gram amount — normalise to 100g
          const factor = 100 / servingGram
          calories = calories * factor
          fat      = fat      * factor
          carbs    = carbs    * factor
          protein  = protein  * factor
          serving_size_g = servingGram
        } else if (isBranded) {
          // "Per 1 serving" with no gram amount — fetch full detail
          const detail = await getFoodDetail(f.food_id)
          if (detail) {
            return {
              barcode:           null,
              name:              f.food_name.trim(),
              brand:             f.brand_name?.trim() || null,
              calories_per_100g: detail.calories_per_100g,
              protein_per_100g:  detail.protein_per_100g,
              carbs_per_100g:    detail.carbs_per_100g,
              fat_per_100g:      detail.fat_per_100g,
              fibre_per_100g:    detail.fibre_per_100g,
              serving_size_g:    detail.serving_size_g,
              source:            'openfoodfacts' as const,
              user_id:           null,
            }
          }
        }

        return {
          barcode:           null,
          name:              f.food_name.trim(),
          brand:             f.brand_name?.trim() || null,
          calories_per_100g: Math.round(calories),
          protein_per_100g:  Math.round(protein * 10) / 10,
          carbs_per_100g:    Math.round(carbs   * 10) / 10,
          fat_per_100g:      Math.round(fat     * 10) / 10,
          fibre_per_100g,
          serving_size_g,
          source:            'openfoodfacts' as const,
          user_id:           null,
        }
      })
  )

  return results.filter(Boolean)
}

// ── Route ─────────────────────────────────────────────────────────────────

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

  if (localFoods && localFoods.length >= 6) {
    return NextResponse.json({ foods: sortByRelevance(localFoods, q) })
  }

  // 2. FatSecret
  const external = (await searchFatSecret(q)).filter(Boolean)

  // 3. Cache best-effort
  if (external.length > 0) {
    supabase.from('foods')
      .insert(external)
      .then(() => null).catch(() => null)
  }

  // 4. Merge and return
  const seen = new Set<string>()
  const merged = [...(localFoods || []), ...external].filter(f => {
    const key = (f.name as string).toLowerCase()
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
    if (a.serving_size_g && !b.serving_size_g) return -1
    if (b.serving_size_g && !a.serving_size_g) return 1
    return al.length - bl.length
  })
}
