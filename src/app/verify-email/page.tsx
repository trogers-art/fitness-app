'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function VerifyEmailPage() {
  const router   = useRouter()
  const supabase = createClient()
  const [email,     setEmail]     = useState<string | null>(null)
  const [sending,   setSending]   = useState(false)
  const [sent,      setSent]      = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  useState(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email ?? null)
    })
  })

  async function handleResend() {
    if (!email) return
    setSending(true)
    setError(null)
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    if (error) { setError(error.message); setSending(false); return }
    setSent(true)
    setSending(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: '48px 16px',
    }}>
      <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
        <div style={{ marginBottom: 32 }}>
          <span style={{
            fontFamily: 'DM Mono, monospace', fontSize: 11, letterSpacing: '0.22em',
            textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 500,
          }}>
            FitApp
          </span>
        </div>

        <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--page-title)', margin: '0 0 12px' }}>
          Confirm your email to continue
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, margin: '0 0 28px' }}>
          It's been more than 7 days since you signed up{email ? ` (${email})` : ''}, and we still
          haven't received confirmation of your email address. Please confirm to keep using FitApp.
        </p>

        {error && (
          <div style={{ padding: '10px 14px', borderLeft: '2px solid var(--red)', color: 'var(--red)', fontSize: 12, marginBottom: 20, textAlign: 'left' }}>
            {error}
          </div>
        )}

        {sent ? (
          <div style={{ padding: '10px 14px', borderLeft: '2px solid var(--green)', color: 'var(--green)', fontSize: 12, marginBottom: 20, textAlign: 'left' }}>
            Confirmation email sent. Check your inbox.
          </div>
        ) : (
          <button onClick={handleResend} disabled={sending || !email} className="btn"
            style={{ width: '100%', padding: '12px', fontSize: 13, marginBottom: 12, opacity: (sending || !email) ? 0.5 : 1 }}>
            {sending ? 'Sending...' : 'Resend confirmation email'}
          </button>
        )}

        <button onClick={handleSignOut}
          style={{ width: '100%', padding: '10px', fontSize: 12, color: 'var(--text-3)', background: 'none', border: '1px solid var(--border-2)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
          Sign out
        </button>
      </div>
    </div>
  )
}
