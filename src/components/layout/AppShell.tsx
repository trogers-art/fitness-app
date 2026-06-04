'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: <GridIcon /> },
  { href: '/food',      label: 'Food',      icon: <FoodIcon /> },
  { href: '/workouts',  label: 'Workouts',  icon: <WorkoutIcon /> },
  { href: '/exercises', label: 'Exercises', icon: <ExerciseIcon /> },
  { href: '/body',      label: 'Body',      icon: <BodyIcon /> },
  { href: '/habits',    label: 'Habits',    icon: <HabitsIcon /> },
]

function GridIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" stroke="currentColor" strokeWidth="1.5"/><rect x="9" y="1" width="6" height="6" stroke="currentColor" strokeWidth="1.5"/><rect x="1" y="9" width="6" height="6" stroke="currentColor" strokeWidth="1.5"/><rect x="9" y="9" width="6" height="6" stroke="currentColor" strokeWidth="1.5"/></svg>
}
function FoodIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 2v4a3 3 0 006 0V2M6 2v12M13 2c0 0 0 4-2 5v7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/></svg>
}
function WorkoutIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 8h2m10 0h2M3 8h10M3 6v4M13 6v4M5 7V5M11 7V5M5 11V9M11 11V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/></svg>
}
function ExerciseIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2v12M2 5l6 3 6-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter"/></svg>
}
function BodyIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="3.5" r="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M5 7h6M8 7v5M6 14h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/></svg>
}
function HabitsIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 8l4 4 8-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter"/></svg>
}

interface Props {
  email: string
  children: React.ReactNode
}

export default function AppShell({ email, children }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [accountOpen, setAccountOpen] = useState(false)

  const initials = email.slice(0, 2).toUpperCase()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ background: 'var(--bg)' }}>

      {/* ── Sidebar (desktop) ── */}
      <aside className="hidden lg:flex flex-col w-56 border-r shrink-0 fixed h-full"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>

        {/* Logo */}
        <div className="px-6 py-5 border-b" style={{ borderColor: 'var(--border)' }}>
          <span className="text-xs uppercase tracking-[0.3em] text-[var(--text-3)]">FitApp</span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-4">
          {NAV.map(item => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 px-6 py-2.5 text-sm transition-all ${active
                  ? 'text-[var(--accent)] border-r-2 border-[var(--accent)]'
                  : 'text-[var(--text-2)] hover:text-[var(--text)]'}`}>
                <span className={active ? 'text-[var(--accent)]' : 'text-[var(--text-3)]'}>{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* User block */}
        <div className="border-t p-4" style={{ borderColor: 'var(--border)' }}>
          <div className="relative">
            <button
              onClick={() => setAccountOpen(o => !o)}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[var(--surface-2)] transition-colors text-left">
              <div className="w-7 h-7 flex items-center justify-center text-xs font-medium shrink-0"
                style={{ background: 'var(--accent)', color: '#000' }}>
                {initials}
              </div>
              <span className="text-xs text-[var(--text-2)] truncate flex-1">{email}</span>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0 text-[var(--text-3)]">
                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/>
              </svg>
            </button>

            {accountOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-1 border py-1"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--border-2)' }}>
                <Link href="/account" onClick={() => setAccountOpen(false)}
                  className="flex items-center gap-2 px-4 py-2 text-xs text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-colors">
                  Account settings
                </Link>
                <div className="h-px my-1" style={{ background: 'var(--border)' }} />
                <button onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-4 py-2 text-xs text-[var(--red)] hover:bg-[var(--surface)] transition-colors">
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── Top bar (mobile) ── */}
      <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b sticky top-0 z-40"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <span className="text-xs uppercase tracking-[0.3em] text-[var(--text-3)]">FitApp</span>
        <div className="relative">
          <button onClick={() => setAccountOpen(o => !o)}
            className="w-8 h-8 flex items-center justify-center text-xs font-medium"
            style={{ background: 'var(--accent)', color: '#000' }}>
            {initials}
          </button>
          {accountOpen && (
            <div className="absolute top-full right-0 mt-1 w-48 border py-1 z-50"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--border-2)' }}>
              <div className="px-4 py-2 text-xs text-[var(--text-3)] border-b truncate"
                style={{ borderColor: 'var(--border)' }}>{email}</div>
              <Link href="/account" onClick={() => setAccountOpen(false)}
                className="flex items-center px-4 py-2 text-xs text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-colors">
                Account settings
              </Link>
              <button onClick={handleSignOut}
                className="w-full text-left px-4 py-2 text-xs text-[var(--red)] hover:bg-[var(--surface)] transition-colors">
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="flex-1 lg:ml-56 pb-20 lg:pb-0">
        <div className="max-w-2xl mx-auto px-4 py-6">
          {children}
        </div>
      </main>

      {/* ── Bottom nav (mobile) ── */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 border-t z-40 grid"
        style={{
          background: 'var(--surface)',
          borderColor: 'var(--border)',
          gridTemplateColumns: `repeat(${NAV.length}, 1fr)`
        }}>
        {NAV.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link key={item.href} href={item.href}
              className={`flex flex-col items-center gap-1 py-3 text-[10px] transition-all ${active ? 'text-[var(--accent)]' : 'text-[var(--text-3)]'}`}>
              {item.icon}
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
