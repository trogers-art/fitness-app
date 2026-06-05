import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const EntrySchema = z.object({
  food_id:             z.string().uuid().optional(),
  meal_type:           z.enum(['breakfast','lunch','dinner','snack','pre_workout','post_workout']),
  quantity_g:          z.number().min(1).max(5000),
  serving_description: z.string().optional(),
  calories_total:      z.number().optional(),
  protein_total:       z.number().optional(),
  carbs_total:         z.number().optional(),
  fat_total:           z.number().optional(),
  // Inline food creation
  create_food: z.object({
    name:              z.string().min(1),
    calories_per_100g: z.number().min(0),
    protein_per_100g:  z.number().min(0),
    carbs_per_100g:    z.number().min(0),
    fat_per_100g:      z.number().min(0),
    source:            z.literal('custom'),
  }).optional(),
  // Inline food data when no food_id available (from FatSecret serving)
  food_name:           z.string().optional(),
  food_brand:          z.string().nullable().optional(),
  calories_per_100g:   z.number().optional(),
  protein_per_100g:    z.number().optional(),
  carbs_per_100g:      z.number().optional(),
  fat_per_100g:        z.number().optional(),
  logged_at:           z.string().optional(),
})

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = EntrySchema.safeParse(body)
  if (!parsed.success) {
    console.error('[entries] validation error:', parsed.error.flatten())
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const {
    food_id, meal_type, quantity_g,
    serving_description, calories_total, protein_total, carbs_total, fat_total,
    create_food, food_name, food_brand,
    calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g,
    logged_at,
  } = parsed.data

  let resolvedFoodId = food_id

  // Case 1: explicit create_food payload
  if (create_food && !resolvedFoodId) {
    const { data: newFood, error } = await supabase
      .from('foods')
      .insert({ ...create_food, user_id: user.id })
      .select('id').single()
    if (error || !newFood) return NextResponse.json({ error: 'Failed to create food' }, { status: 500 })
    resolvedFoodId = newFood.id
  }

  // Case 2: food data provided inline (from FatSecret serving picker, no DB id yet)
  if (!resolvedFoodId && food_name && calories_per_100g != null) {
    // Try to find existing food by name first
    const { data: existing } = await supabase
      .from('foods')
      .select('id')
      .ilike('name', food_name)
      .is('user_id', null)
      .limit(1)
      .single()

    if (existing) {
      resolvedFoodId = existing.id
    } else {
      // Create it
      const { data: newFood, error } = await supabase
        .from('foods')
        .insert({
          name:              food_name,
          brand:             food_brand || null,
          calories_per_100g: calories_per_100g,
          protein_per_100g:  protein_per_100g  ?? 0,
          carbs_per_100g:    carbs_per_100g    ?? 0,
          fat_per_100g:      fat_per_100g      ?? 0,
          source:            'openfoodfacts',
          user_id:           null,
        })
        .select('id').single()
      if (!error && newFood) resolvedFoodId = newFood.id
    }
  }

  if (!resolvedFoodId) {
    return NextResponse.json({ error: 'Could not resolve food — provide food_id or food_name + macros' }, { status: 400 })
  }

  const { data: entry, error } = await supabase
    .from('food_entries')
    .insert({
      user_id:             user.id,
      food_id:             resolvedFoodId,
      meal_type,
      quantity_g,
      logged_at:           logged_at || new Date().toISOString(),
      serving_description: serving_description || null,
      calories_total:      calories_total      || null,
      protein_total:       protein_total       || null,
      carbs_total:         carbs_total         || null,
      fat_total:           fat_total           || null,
    })
    .select('id').single()

  if (error) {
    console.error('[entries] insert error:', error)
    return NextResponse.json({ error: 'Failed to log entry' }, { status: 500 })
  }

  return NextResponse.json({ entry })
}
