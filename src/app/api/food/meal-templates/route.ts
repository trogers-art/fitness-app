import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const CreateSchema = z.object({
  name:        z.string().min(1).max(100),
  description: z.string().max(300).optional(),
  meal_type:   z.enum(['breakfast','lunch','dinner','snack','pre_workout','post_workout']).optional(),
  items: z.array(z.object({
    food_id:    z.string().uuid(),
    quantity_g: z.number().min(1).max(5000),
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

  const body = await request.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { name, description, meal_type, items } = parsed.data

  const { data: template, error } = await supabase
    .from('meal_templates')
    .insert({ user_id: user.id, name, description, meal_type })
    .select('id')
    .single()

  if (error || !template) return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })

  await supabase.from('meal_template_items').insert(
    items.map((item, i) => ({
      template_id: template.id,
      food_id:     item.food_id,
      quantity_g:  item.quantity_g,
      order_index: i,
    }))
  )

  return NextResponse.json({ template_id: template.id })
}
