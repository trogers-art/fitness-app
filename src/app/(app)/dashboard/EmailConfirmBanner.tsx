'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function EmailConfirmBanner({ email }: { email: string }) {
  const supabase = createClient()
  const [sending, setSending] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function handleResend() {
    setSending(true)
    setError(null)
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    if (error) { setError(error.message); setSending(false); return }
    setSent(true)
    setSending(false)
  }

  return (
    <div style={{
      padding: '10px 14px', borderLeft: '2px solid var(--amber)', fontSize: 12, color: 'var(--amber)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
    }}>
      <span>
        {sent ? 'Confirmation email sent — check your inbox.' : 'Confirm your email — check your inbox.'}
      </span>
      {!sent && (
        <button
          onClick={handleResend}
          disabled={sending}
          style={{
            fontSize: 11, padding: '4px 10px', background: 'none', border: '1px solid var(--amber)',
            color: 'var(--amber)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
            opacity: sending ? 0.5 : 1, flexShrink: 0,
          }}>
          {sending ? 'Sending...' : 'Resend'}
        </button>
      )}
      {error && <span style={{ color: 'var(--red)', fontSize: 11, width: '100%' }}>{error}</span>}
    </div>
  )
}
