import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Step 2: Proxy GIF stream from ExerciseDB — API key never exposed to client
export async function GET(request: NextRequest) {
  // Auth check — must be logged in to use this endpoint
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const edbId = request.nextUrl.searchParams.get('edb_id')
  if (!edbId || !/^\d+$/.test(edbId)) {
    return new NextResponse('Invalid exercise ID', { status: 400 })
  }

  const apiKey = process.env.RAPIDAPI_KEY
  if (!apiKey) return new NextResponse('Service unavailable', { status: 503 })

  try {
    const upstream = await fetch(
      `https://exercisedb.p.rapidapi.com/image?exerciseId=${edbId}&resolution=180`,
      {
        headers: {
          'X-RapidAPI-Key':  apiKey,
          'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com',
        },
      }
    )

    if (!upstream.ok) {
      return new NextResponse('GIF not found', { status: 404 })
    }

    // Stream the GIF back with aggressive caching — only hits ExerciseDB once per exercise
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'Content-Type':  'image/gif',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return new NextResponse('Failed to fetch GIF', { status: 502 })
  }
}
