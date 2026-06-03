import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeMetrics } from '@/lib/utils/metrics'
import { OnboardingSchema } from '@/lib/validators'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = OnboardingSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const metrics = computeMetrics(parsed.data)

    // Upsert into user_profiles
    const { data, error } = await supabase
      .from('user_profiles')
      .upsert(
        { user_id: user.id, ...metrics, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
      .select()
      .single()

    if (error) {
      console.error('Profile upsert error:', error)
      return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 })
    }

    return NextResponse.json({ profile: data })
  } catch (err) {
    console.error('Metrics route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
