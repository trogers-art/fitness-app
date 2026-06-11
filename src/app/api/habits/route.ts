import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('habits')
    .select('*')
    .eq('user_id', user.id)
    .eq('active', true)
    .order('order_index')
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ habits: data || [] })
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name, type = 'binary', target_count = 1, category = '' } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  // Get next order_index
  const { count } = await supabase
    .from('habits')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('active', true)

  const { data, error } = await supabase
    .from('habits')
    .insert({
      user_id:      user.id,
      name:         name.trim(),
      type,
      target_count: type === 'count' ? (target_count || 1) : 1,
      category:     category || null,
      frequency:    'daily',
      active:       true,
      order_index:  count || 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ habit: data })
}
