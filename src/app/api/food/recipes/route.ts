import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'

function sign(method: string, url: string, params: Record<string, string>, secret: string): string {
  const normalized = Object.keys(params).sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join('&')
  const base = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(normalized)}`
  return crypto.createHmac('sha1', `${encodeURIComponent(secret)}&`).update(base).digest('base64')
}

async function fatSecretPOST(methodName: string, extra: Record<string, string>) {
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
    if (data.error) return null
    return data
  } catch { return null }
}

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = request.nextUrl.searchParams.get('q')?.trim() || ''

  const data = await fatSecretPOST('recipes.search.v3', {
    search_expression: q,
    max_results: '12',
    page_number: '0',
    must_have_images: 'false',
  })

  if (!data?.recipes?.recipe) return NextResponse.json({ recipes: [] })

  const list = Array.isArray(data.recipes.recipe) ? data.recipes.recipe : [data.recipes.recipe]

  const recipes = list.map((r: any) => ({
    id:          r.recipe_id,
    name:        r.recipe_name,
    description: r.recipe_description,
    image:       r.recipe_image || null,
    calories:    Math.round(parseFloat(r.recipe_nutrition?.calories || '0')),
    protein:     Math.round(parseFloat(r.recipe_nutrition?.protein  || '0') * 10) / 10,
    carbs:       Math.round(parseFloat(r.recipe_nutrition?.carbohydrate || '0') * 10) / 10,
    fat:         Math.round(parseFloat(r.recipe_nutrition?.fat || '0') * 10) / 10,
    ingredients: Array.isArray(r.recipe_ingredients?.ingredient)
      ? r.recipe_ingredients.ingredient
      : r.recipe_ingredients?.ingredient ? [r.recipe_ingredients.ingredient] : [],
    types: Array.isArray(r.recipe_types?.recipe_type)
      ? r.recipe_types.recipe_type
      : r.recipe_types?.recipe_type ? [r.recipe_types.recipe_type] : [],
  }))

  return NextResponse.json({ recipes })
}
