import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const CreateSchema = z.object({
  name:        z.string().min(1).max(100),
  description: z.string().max(300).optional(),
  meal_type:   z.enum(['breakfast','lunch','dinner','snack','pre_workout','post_workout']).optional(),
  items: z.array(z.object({
    food_id:             z.string().uuid().optional(),
    food_name:           z.string().optional(),
    food_brand:          z.string().nullable().optional(),
    calories_per_100g:   z.number().optional(),
    protein_per_100g:    z.number().optional(),
    carbs_per_100g:      z.number().optional(),
    fat_per_100g:        z.number().optional(),
    quantity_g:          z.number().min(1).max(5000),
    serving_description: z.string().optional(),
    calories_total:      z.number().optional(),
    protein_total:       z.number().optional(),
    carbs_total:         z.number().optional(),
    fat_total:           z.number().optional(),
  })).min(1),
})

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: templates } = await supabase
    .from('meal_templates')
    .select(`
      id, name, description, meal_type, created_at,
      items:meal_template_items (
        id, quantity_g, order_index,
        serving_description, calories_total, protein_total, carbs_total, fat_total,
        food:foods ( id, name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g )
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ templates: templates || [] })
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await request.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })

  const { name, description, meal_type, items } = parsed.data

  const { data: template, error } = await supabase
    .from('meal_templates')
    .insert({ user_id: user.id, name, description, meal_type })
    .select('id')
    .single()

  if (error || !template) return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })

  // Resolve food_ids — if no food_id provided, find or create the food in DB
  const resolvedItems = await Promise.all(items.map(async (item, i) => {
    let foodId = item.food_id

    if (!foodId && item.food_name && item.calories_per_100g != null) {
      // Try to find existing food by name
      const { data: existing } = await supabase
        .from('foods')
        .select('id')
        .ilike('name', item.food_name)
        .is('user_id', null)
        .limit(1)
        .single()

      if (existing) {
        foodId = existing.id
      } else {
        const { data: newFood } = await supabase
          .from('foods')
          .insert({
            name:              item.food_name,
            brand:             item.food_brand || null,
            calories_per_100g: item.calories_per_100g,
            protein_per_100g:  item.protein_per_100g  ?? 0,
            carbs_per_100g:    item.carbs_per_100g    ?? 0,
            fat_per_100g:      item.fat_per_100g      ?? 0,
            source:            'openfoodfacts',
            user_id:           null,
          })
          .select('id')
          .single()
        if (newFood) foodId = newFood.id
      }
    }

    if (!foodId) return null

    return {
      template_id:         template.id,
      food_id:             foodId,
      quantity_g:          item.quantity_g,
      order_index:         i,
      serving_description: item.serving_description ?? null,
      calories_total:      item.calories_total       ?? null,
      protein_total:       item.protein_total        ?? null,
      carbs_total:         item.carbs_total          ?? null,
      fat_total:           item.fat_total            ?? null,
    }
  }))

  const validItems = resolvedItems.filter(Boolean)
  if (validItems.length > 0) {
    await supabase.from('meal_template_items').insert(validItems)
  }

  return NextResponse.json({ template_id: template.id })
}
