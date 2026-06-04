import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const EntrySchema = z.object({
  food_id:    z.string().uuid().optional(),
  meal_type:  z.enum(['breakfast','lunch','dinner','snack','pre_workout','post_workout']),
  quantity_g: z.number().min(1).max(5000),
  create_food: z.object({
    name:              z.string().min(1),
    calories_per_100g: z.number().min(0),
    protein_per_100g:  z.number().min(0),
    carbs_per_100g:    z.number().min(0),
    fat_per_100g:      z.number().min(0),
    source:            z.literal('custom'),
  }).optional(),
})

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = EntrySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })

  const { food_id, meal_type, quantity_g, create_food } = parsed.data
  let resolvedFoodId = food_id

  // Create custom food first if provided
  if (create_food) {
    const { data: newFood, error: foodError } = await supabase
      .from('foods')
      .insert({ ...create_food, user_id: user.id })
      .select('id')
      .single()
    if (foodError || !newFood) return NextResponse.json({ error: 'Failed to create food' }, { status: 500 })
    resolvedFoodId = newFood.id
  }

  if (!resolvedFoodId) return NextResponse.json({ error: 'food_id required' }, { status: 400 })

  const { data: entry, error } = await supabase
    .from('food_entries')
    .insert({ user_id: user.id, food_id: resolvedFoodId, meal_type, quantity_g, logged_at: new Date().toISOString() })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: 'Failed to log entry' }, { status: 500 })

  return NextResponse.json({ entry })
}
