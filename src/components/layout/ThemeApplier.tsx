'use client'

import { useEffect } from 'react'

export default function ThemeApplier({ theme }: { theme: string }) {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return null
}
