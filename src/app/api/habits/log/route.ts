import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET: fetch last 84 days of logs for all user habits
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const since = new Date()
  since.setDate(since.getDate() - 83)
  const sinceDate = since.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('habit_logs')
    .select('id, habit_id, logged_date, count')
    .eq('user_id', user.id)
    .gte('logged_date', sinceDate)
    .order('logged_date')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ logs: data || [] })
}

// POST: log or update a habit for a given date
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { habit_id, logged_date, count = 1 } = body

  if (!habit_id || !logged_date) {
    return NextResponse.json({ error: 'habit_id and logged_date required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('habit_logs')
    .upsert({
      habit_id,
      user_id:      user.id,
      logged_date,
      count,
      completed_at: new Date().toISOString(),
    }, { onConflict: 'habit_id,user_id,logged_date' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ log: data })
}

// DELETE: remove a log entry for a given date (uncheck)
export async function DELETE(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { habit_id, logged_date } = await request.json()
  if (!habit_id || !logged_date) {
    return NextResponse.json({ error: 'habit_id and logged_date required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('habit_logs')
    .delete()
    .eq('habit_id', habit_id)
    .eq('user_id', user.id)
    .eq('logged_date', logged_date)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
