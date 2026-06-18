import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const GRACE_PERIOD_DAYS = 7

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/signup') ||
    request.nextUrl.pathname.startsWith('/onboarding')

  const isApiRoute = request.nextUrl.pathname.startsWith('/api')

  // Routes always allowed even when locked out for unconfirmed email past grace period
  const isVerifyRoute  = request.nextUrl.pathname.startsWith('/verify-email')
  const isAccountRoute = request.nextUrl.pathname.startsWith('/account')

  // Redirect unauthenticated users to login (skip API routes)
  if (!user && !isAuthRoute && !isApiRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from auth screens
  if (user && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // ── 7-day email confirmation grace period ──────────────────────────────
  // After signup the user can use the app immediately. If they still haven't
  // confirmed their email after GRACE_PERIOD_DAYS, block further app access
  // (except account settings and the verify-email page) until they confirm.
  if (user && !user.email_confirmed_at && !isApiRoute && !isAuthRoute && !isVerifyRoute && !isAccountRoute) {
    const createdAt = new Date(user.created_at).getTime()
    const daysSinceSignup = (Date.now() - createdAt) / (1000 * 60 * 60 * 24)

    if (daysSinceSignup > GRACE_PERIOD_DAYS) {
      const url = request.nextUrl.clone()
      url.pathname = '/verify-email'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
