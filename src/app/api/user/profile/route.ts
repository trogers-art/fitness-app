import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { OnboardingSchema } from '@/lib/validators'
import { computeMetrics } from '@/lib/utils/metrics'
import { z } from 'zod'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile, error } = await supabase
    .from('user_profiles').select('*').eq('user_id', user.id).single()

  if (error) return NextResponse.json({ profile: null })
  return NextResponse.json({ profile })
}

export async function PUT(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  // Partial update — theme or target_weight_kg
  const partialFields = ['theme', 'target_weight_kg']
  const isPartial = Object.keys(body).every(k => partialFields.includes(k))
  if (isPartial) {
    const PartialSchema = z.object({
      theme:            z.enum(['default', 'dark', 'light']).optional(),
      target_weight_kg: z.number().min(20).max(300).optional(),
    })
    const parsed = PartialSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

    const { data, error } = await supabase
      .from('user_profiles')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .select().single()

    if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    return NextResponse.json({ profile: data })
  }

  // Full profile update
  const parsed = OnboardingSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })

  const metrics = computeMetrics(parsed.data)
  const { data, error } = await supabase
    .from('user_profiles')
    .update({ ...metrics, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .select().single()

  if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  return NextResponse.json({ profile: data })
}
