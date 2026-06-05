import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('meal_templates')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  return NextResponse.json({ success: true })
}

// Log all items in a template as food entries
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const meal_type = body.meal_type || 'snack'

  // Get template items
  const { data: items } = await supabase
    .from('meal_template_items')
    .select('food_id, quantity_g, template:meal_templates!inner(user_id)')
    .eq('template_id', params.id)

  if (!items?.length) return NextResponse.json({ error: 'Template not found or empty' }, { status: 404 })

  // Verify ownership
  const owned = (items[0].template as any)?.user_id === user.id
  if (!owned) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const entries = items.map(item => ({
    user_id:    user.id,
    food_id:    item.food_id,
    meal_type,
    quantity_g: item.quantity_g,
    logged_at:  new Date().toISOString(),
  }))

  const { error } = await supabase.from('food_entries').insert(entries)
  if (error) return NextResponse.json({ error: 'Failed to log entries' }, { status: 500 })

  return NextResponse.json({ logged: entries.length })
}
