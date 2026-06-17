'use client'

import { useEffect } from 'react'

export default function TimezoneSync({ savedTimezone }: { savedTimezone: string }) {
  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (!detected || detected === savedTimezone) return

    // Save detected timezone silently
    fetch('/api/user/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ timezone: detected }),
    }).catch(() => {}) // silent fail — non-critical
  }, [savedTimezone])

  return null
}
