'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router   = useRouter()
  const supabase = createClient()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/dashboard')
    router.refresh()
  }

  async function handleGoogleLogin() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return (
    <div>
      {/* Heading */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, color: 'var(--page-title)', margin: '0 0 6px', fontFamily: 'DM Sans, sans-serif' }}>
          Sign in
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>Welcome back.</p>
      </div>

      {error && (
        <div style={{ marginBottom: 20, padding: '10px 14px', borderLeft: '2px solid var(--red)', color: 'var(--red)', fontSize: 12 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com" required />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input" type="password" value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••" required />
        </div>
        <button type="submit" disabled={loading} className="btn" style={{ marginTop: 4, width: '100%', padding: '12px', fontSize: 13 }}>
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '24px 0 16px' }}>
        <div style={{ flex: 1, height: 1, background: 'var(--border-2)' }} />
        <span style={{ fontSize: 10, color: 'var(--text-3)' }}>or</span>
        <div style={{ flex: 1, height: 1, background: 'var(--border-2)' }} />
      </div>

      <button
        onClick={handleGoogleLogin}
        style={{
          width: '100%', padding: '10px 12px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          background: 'none', border: '1px solid var(--border-2)',
          cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-3)'; e.currentTarget.style.background = 'var(--surface-2)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-2)'; e.currentTarget.style.background = 'none' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Continue with Google</span>
      </button>

      <p style={{ marginTop: 28, fontSize: 11, color: 'var(--text-3)' }}>
        No account?{' '}
        <Link href="/signup" style={{ color: 'var(--text-2)', borderBottom: '1px solid var(--border-2)', paddingBottom: 1 }}>
          Sign up
        </Link>
      </p>
    </div>
  )
}
