import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = request.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) {
    return NextResponse.json({ foods: [] })
  }

  // Search global foods + user's custom foods
  const { data: foods, error } = await supabase
    .from('foods')
    .select('*')
    .or(`user_id.is.null,user_id.eq.${user.id}`)
    .ilike('name', `%${q}%`)
    .order('name')
    .limit(20)

  if (error) return NextResponse.json({ error: 'Search failed' }, { status: 500 })

  return NextResponse.json({ foods: foods || [] })
}
