import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fatSecretPOST } from '@/lib/utils/fatsecret'

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = request.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ suggestions: [] })

  const data = await fatSecretPOST('foods.autocomplete', {
    expression:  q,
    max_results: '8',
    format:      'json',
  })

  const raw = data?.suggestions?.suggestion
  if (!raw) return NextResponse.json({ suggestions: [] })
  const suggestions: string[] = Array.isArray(raw) ? raw : [raw]
  return NextResponse.json({ suggestions })
}
