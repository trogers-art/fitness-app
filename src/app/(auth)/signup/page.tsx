'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <div>
      <h1 className="text-2xl font-semibold text-[var(--text)] mb-1">Create account</h1>
      <p className="text-sm text-[var(--text-2)] mb-8">Get your plan in minutes.</p>

      {error && (
        <div className={`mb-6 px-4 py-3 border text-sm ${error.includes('confirm') ? 'border-[var(--amber)] bg-[#ffaa0010] text-[var(--amber)]' : 'border-[var(--red)] bg-[#ff444410] text-[var(--red)]'}`}>
          {error}
        </div>
      )}

      <form onSubmit={handleSignup} className="space-y-4">
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={email}
            onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input" type="password" value={password}
            onChange={e => setPassword(e.target.value)} placeholder="Min 8 characters" minLength={8} required />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <p className="mt-8 text-sm text-[var(--text-3)]">
        Have an account?{' '}
        <Link href="/login" className="text-[var(--dark)] hover:underline">Sign in</Link>
      </p>
    </div>
  )
}
