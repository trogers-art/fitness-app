import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Fetch GIF from ExerciseDB (RapidAPI) and cache in DB
export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const exerciseId = request.nextUrl.searchParams.get('exercise_id')
  const name       = request.nextUrl.searchParams.get('name')
  if (!exerciseId || !name) return NextResponse.json({ error: 'exercise_id and name required' }, { status: 400 })

  const apiKey = process.env.RAPIDAPI_KEY
  if (!apiKey) return NextResponse.json({ gif_url: null })

  try {
    // Search ExerciseDB by name
    const res = await fetch(
      `https://exercisedb.p.rapidapi.com/exercises/name/${encodeURIComponent(name.toLowerCase())}?limit=5`,
      {
        headers: {
          'X-RapidAPI-Key':  apiKey,
          'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com',
        },
      }
    )

    if (!res.ok) return NextResponse.json({ gif_url: null })

    const data = await res.json()
    const match = Array.isArray(data) && data.length > 0 ? data[0] : null
    const gif_url = match?.gifUrl || null

    // Cache in DB
    if (gif_url) {
      await supabase.from('exercises')
        .update({ gif_url })
        .eq('id', exerciseId)
    }

    return NextResponse.json({ gif_url })
  } catch {
    return NextResponse.json({ gif_url: null })
  }
}
