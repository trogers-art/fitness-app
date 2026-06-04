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
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="1" y="1" width="5.5" height="5.5" stroke="currentColor" strokeWidth="1.25"/><rect x="8.5" y="1" width="5.5" height="5.5" stroke="currentColor" strokeWidth="1.25"/><rect x="1" y="8.5" width="5.5" height="5.5" stroke="currentColor" strokeWidth="1.25"/><rect x="8.5" y="8.5" width="5.5" height="5.5" stroke="currentColor" strokeWidth="1.25"/></svg>
}
function FoodIcon() {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M3 1.5v4a3 3 0 006 0v-4M6 1.5v11M12.5 1.5c0 0 0 4-2 5v6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="square"/></svg>
}
function WorkoutIcon() {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M1 7.5h1.5m10 0H14m-11.5 0h9M2.5 5.5v4M12.5 5.5v4M4.5 6.5v-2M10.5 6.5v-2M4.5 10.5v-2M10.5 10.5v-2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="square"/></svg>
}
function ExerciseIcon() {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M7.5 1.5v12M1.5 4.5l6 3 6-3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="square" strokeLinejoin="miter"/></svg>
}
function BodyIcon() {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.25"/><path d="M4.5 6.5h6M7.5 6.5v5M5.5 13.5h4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="square"/></svg>
}
function HabitsIcon() {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 7.5l3.5 3.5 7.5-7.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="square" strokeLinejoin="miter"/></svg>
}
function ChevronIcon() {
  return <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="square"/></svg>
}

interface Props { email: string; children: React.ReactNode }

export default function AppShell({ email, children }: Props) {
  const pathname = usePathname()
  const router   = useRouter()
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

      {/* ── Sidebar desktop ── */}
      <aside className="hidden lg:flex flex-col w-52 fixed h-full"
        style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}>

        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 500 }}>
            FitApp
          </span>
        </div>

        <nav className="flex-1 py-3">
          {NAV.map(item => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link key={item.href} href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 20px',
                  fontSize: 13,
                  fontWeight: active ? 500 : 400,
                  color: active ? 'var(--accent)' : 'var(--text-2)',
                  borderRight: active ? '2px solid var(--accent)' : '2px solid transparent',
                  transition: 'color 0.15s',
                  textDecoration: 'none',
                }}>
                <span style={{ color: active ? 'var(--accent)' : 'var(--text-3)' }}>{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* User block */}
        <div style={{ borderTop: '1px solid var(--border)', padding: 12 }}>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setAccountOpen(o => !o)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', cursor: 'pointer', background: 'none', border: 'none',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              <div style={{
                width: 28, height: 28, background: 'var(--accent)', color: '#000',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, flexShrink: 0,
              }}>{initials}</div>
              <span style={{ fontSize: 12, color: 'var(--text-2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>
                {email}
              </span>
              <span style={{ color: 'var(--text-3)', flexShrink: 0 }}><ChevronIcon /></span>
            </button>

            {accountOpen && (
              <div style={{
                position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 4,
                background: 'var(--surface-3)', border: '1px solid var(--border-2)',
                zIndex: 50,
              }}>
                <Link href="/account" onClick={() => setAccountOpen(false)}
                  style={{ display: 'block', padding: '9px 14px', fontSize: 12, color: 'var(--text-2)', textDecoration: 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-2)')}>
                  Account settings
                </Link>
                <div style={{ height: 1, background: 'var(--border)' }} />
                <button onClick={handleSignOut}
                  style={{ width: '100%', padding: '9px 14px', fontSize: 12, color: 'var(--red)', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── Mobile top bar ── */}
      <header className="lg:hidden flex items-center justify-between px-4 py-3 sticky top-0 z-40"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 500 }}>
          FitApp
        </span>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setAccountOpen(o => !o)}
            style={{ width: 32, height: 32, background: 'var(--accent)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
            {initials}
          </button>
          {accountOpen && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 4,
              width: 180, background: 'var(--surface-3)', border: '1px solid var(--border-2)', zIndex: 50,
            }}>
              <div style={{ padding: '8px 14px', fontSize: 11, color: 'var(--text-3)', borderBottom: '1px solid var(--border)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {email}
              </div>
              <Link href="/account" onClick={() => setAccountOpen(false)}
                style={{ display: 'block', padding: '9px 14px', fontSize: 12, color: 'var(--text-2)', textDecoration: 'none' }}>
                Account settings
              </Link>
              <button onClick={handleSignOut}
                style={{ width: '100%', padding: '9px 14px', fontSize: 12, color: 'var(--red)', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}>
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 lg:ml-52 pb-24 lg:pb-8" style={{ background: 'var(--bg)' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '28px 20px' }}>
          {children}
        </div>
      </main>

      {/* ── Mobile bottom nav ── */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40"
        style={{
          background: 'var(--surface)',
          borderTop: '1px solid var(--border)',
          display: 'grid',
          gridTemplateColumns: `repeat(${NAV.length}, 1fr)`,
        }}>
        {NAV.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link key={item.href} href={item.href}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '10px 4px', fontSize: 9, fontWeight: 500, textTransform: 'uppercase',
                letterSpacing: '0.05em', textDecoration: 'none',
                color: active ? 'var(--accent)' : 'var(--text-3)',
                transition: 'color 0.15s',
              }}>
              {item.icon}
              {item.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
