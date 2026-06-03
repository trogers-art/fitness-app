import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const params = request.nextUrl.searchParams
  const q = params.get('q')?.trim() || ''
  const muscle = params.get('muscle') || 'all'
  const equipment = params.get('equipment') || 'all'
  const type = params.get('type') || 'all'
  const limit = Math.min(parseInt(params.get('limit') || '40'), 100)

  let query = supabase
    .from('exercises')
    .select('*')
    .or(`user_id.is.null,user_id.eq.${user.id}`)
    .order('name')
    .limit(limit)

  if (q.length >= 2) {
    query = query.ilike('name', `%${q}%`)
  }
  if (muscle !== 'all') {
    query = query.eq('muscle_group', muscle)
  }
  if (type !== 'all') {
    query = query.eq('type', type)
  }
  if (equipment !== 'all') {
    query = query.contains('equipment', [equipment])
  }

  const { data: exercises, error } = await query

  if (error) return NextResponse.json({ error: 'Search failed' }, { status: 500 })

  return NextResponse.json({ exercises: exercises || [] })
}
