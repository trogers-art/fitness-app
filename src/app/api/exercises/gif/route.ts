import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Step 1: Look up ExerciseDB ID by name, cache in DB
export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const exerciseId = request.nextUrl.searchParams.get('exercise_id')
  const name       = request.nextUrl.searchParams.get('name')
  if (!exerciseId || !name) return NextResponse.json({ error: 'exercise_id and name required' }, { status: 400 })

  const apiKey = process.env.RAPIDAPI_KEY
  if (!apiKey) return NextResponse.json({ edb_id: null })

  // Simplify name for ExerciseDB search
  const simplified = name
    .toLowerCase()
    .replace(/\s*-\s*\w+\s*grip/i, '')
    .replace(/\s*with\s+.+/i, '')
    .replace(/\s*\(.*?\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  try {
    const res = await fetch(
      `https://exercisedb.p.rapidapi.com/exercises/name/${encodeURIComponent(simplified)}?limit=5`,
      { headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com' } }
    )
    if (!res.ok) return NextResponse.json({ edb_id: null })

    const data = await res.json()
    const match = Array.isArray(data) && data.length > 0 ? data[0] : null
    const edb_id = match?.id || null

    // Store edb_id in gif_url column (repurposed)
    if (edb_id) {
      await supabase.from('exercises')
        .update({ gif_url: `edb:${edb_id}` })
        .eq('id', exerciseId)
    }

    return NextResponse.json({ edb_id })
  } catch {
    return NextResponse.json({ edb_id: null })
  }
}
