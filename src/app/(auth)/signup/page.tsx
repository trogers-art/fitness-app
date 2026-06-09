'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const router   = useRouter()
  const supabase = createClient()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError) { setError(signUpError.message); setLoading(false); return }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      setError('Account created. Check your email to confirm, then sign in.')
      setLoading(false)
      return
    }

    router.push('/onboarding')
    router.refresh()
  }

  const isConfirmMsg = error?.includes('confirm')

  return (
    <div>
      {/* Heading */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, color: 'var(--page-title)', margin: '0 0 6px', fontFamily: 'DM Sans, sans-serif' }}>
          Create account
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>Get your plan in minutes.</p>
      </div>

      {error && (
        <div style={{
          marginBottom: 20, padding: '10px 14px', fontSize: 12,
          borderLeft: `2px solid ${isConfirmMsg ? 'var(--amber)' : 'var(--red)'}`,
          color: isConfirmMsg ? 'var(--amber)' : 'var(--red)',
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
            placeholder="Min 8 characters" minLength={8} required />
        </div>
        <button type="submit" disabled={loading} className="btn" style={{ marginTop: 4, width: '100%', padding: '12px', fontSize: 13 }}>
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <p style={{ marginTop: 28, fontSize: 11, color: 'var(--text-3)' }}>
        Have an account?{' '}
        <Link href="/login" style={{ color: 'var(--text-2)', borderBottom: '1px solid var(--border-2)', paddingBottom: 1 }}>
          Sign in
        </Link>
      </p>
    </div>
  )
}
