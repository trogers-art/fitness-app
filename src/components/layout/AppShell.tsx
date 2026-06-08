'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Main nav — Account replaces Habits in mobile bottom nav (Habits moves to overflow or stays desktop only)
const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: <GridIcon /> },
  { href: '/food',      label: 'Food',      icon: <FoodIcon /> },
  { href: '/workouts',  label: 'Workouts',  icon: <WorkoutIcon /> },
  { href: '/exercises', label: 'Exercises', icon: <ExerciseIcon /> },
  { href: '/body',      label: 'Body',      icon: <BodyIcon /> },
  { href: '/habits',    label: 'Habits',    icon: <HabitsIcon /> },
]

// Mobile bottom nav — 6 items including Account
const MOBILE_NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: <GridIcon /> },
  { href: '/food',      label: 'Food',      icon: <FoodIcon /> },
  { href: '/workouts',  label: 'Workouts',  icon: <WorkoutIcon /> },
  { href: '/body',      label: 'Body',      icon: <BodyIcon /> },
  { href: '/habits',    label: 'Habits',    icon: <HabitsIcon /> },
  { href: '/account',   label: 'Account',   icon: <AccountIcon /> },
]

function GridIcon()    { return <svg width="15" height="15" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="5" height="5" stroke="currentColor" strokeWidth="1.2"/><rect x="8" y="1" width="5" height="5" stroke="currentColor" strokeWidth="1.2"/><rect x="1" y="8" width="5" height="5" stroke="currentColor" strokeWidth="1.2"/><rect x="8" y="8" width="5" height="5" stroke="currentColor" strokeWidth="1.2"/></svg> }
function FoodIcon()    { return <svg width="15" height="15" viewBox="0 0 14 14" fill="none"><path d="M2.5 1.5v3.5a3 3 0 006 0V1.5M5.5 1.5v10M11.5 1.5c0 0 0 3.5-1.5 4.5v5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="square"/></svg> }
function WorkoutIcon() { return <svg width="15" height="15" viewBox="0 0 14 14" fill="none"><path d="M1 7h1.5m9 0H13M2.5 5v4M11.5 5v4M4 6V4M10 6V4M4 10V8M10 10V8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="square"/></svg> }
function ExerciseIcon(){ return <svg width="15" height="15" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 4l6 3 6-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="square"/></svg> }
function BodyIcon()    { return <svg width="15" height="15" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M4 6h6M7 6v5M5 12h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="square"/></svg> }
function HabitsIcon()  { return <svg width="15" height="15" viewBox="0 0 14 14" fill="none"><path d="M1.5 7l3 3 7-7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="square"/></svg> }
function AccountIcon() { return <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.2"/><path d="M2 14c0-3 2.686-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="square"/></svg> }
function ChevronIcon() { return <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1.5 3l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="square"/></svg> }

type Theme = 'default' | 'dark' | 'light'
interface Props { email: string; theme: Theme; children: React.ReactNode }

export default function AppShell({ email, theme: initialTheme, children }: Props) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()
  const [accountOpen, setAccountOpen] = useState(false)
  const [theme, setThemeState] = useState<Theme>(initialTheme)

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  async function handleThemeChange(t: Theme) {
    setThemeState(t)
    document.documentElement.setAttribute('data-theme', t)
    await fetch('/api/user/profile', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: t }), credentials: 'include',
    })
    setAccountOpen(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg)' }}>

      {/* ── Desktop sidebar ── */}
      <aside className="lg-sidebar" style={{
        width: 190, flexShrink: 0, display: 'none', flexDirection: 'column',
        position: 'fixed', height: '100%',
        background: 'var(--sidebar-bg)', borderRight: '1px solid var(--sidebar-border)',
      }}>
        <div style={{ padding: '13px 18px', borderBottom: '1px solid var(--sidebar-border)' }}>
          <span style={{ fontSize: 9, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'var(--sidebar-muted)', fontWeight: 600 }}>FitApp</span>
        </div>

        <nav style={{ flex: 1, paddingTop: 6, paddingBottom: 6 }}>
          {NAV.map(item => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link key={item.href} href={item.href} style={{
                display: 'flex', alignItems: 'center', gap: 9, padding: '9px 18px',
                fontSize: 13, fontWeight: active ? 500 : 400, textDecoration: 'none',
                background: active ? 'var(--nav-active-bg)' : 'transparent',
                color: active ? 'var(--nav-active-fg)' : 'var(--sidebar-text)',
                transition: 'background 0.1s, color 0.1s',
              }}>
                <span style={{ color: active ? 'var(--nav-active-fg)' : 'var(--sidebar-muted)' }}>{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Desktop user menu */}
        <div style={{ borderTop: '1px solid var(--sidebar-border)', padding: 10 }}>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setAccountOpen(o => !o)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 9,
              padding: '7px 8px', cursor: 'pointer', background: 'none', border: 'none',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              <div style={{ width: 26, height: 26, background: 'var(--nav-active-bg)', color: 'var(--nav-active-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                {email.slice(0, 2).toUpperCase()}
              </div>
              <span style={{ fontSize: 11, color: 'var(--sidebar-text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>{email}</span>
              <span style={{ color: 'var(--sidebar-muted)', flexShrink: 0 }}><ChevronIcon /></span>
            </button>

            {accountOpen && (
              <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 4, background: 'var(--surface)', border: '1px solid var(--border-2)', zIndex: 50, boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }}>
                <Link href="/account" onClick={() => setAccountOpen(false)}
                  style={{ display: 'block', padding: '9px 14px', fontSize: 12, color: 'var(--text-2)', textDecoration: 'none' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                  Account settings
                </Link>
                <div style={{ height: 1, background: 'var(--border-2)' }} />
                <button onClick={handleSignOut} style={{ width: '100%', padding: '9px 14px', fontSize: 12, color: 'var(--red)', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── Mobile top bar — wordmark only, no account avatar ── */}
      <header className="mobile-header" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '13px 16px', position: 'sticky', top: 0, zIndex: 40,
        background: 'var(--sidebar-bg)', borderBottom: '1px solid var(--sidebar-border)',
      }}>
        <span style={{ fontSize: 9, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'var(--sidebar-muted)', fontWeight: 600 }}>FitApp</span>
      </header>

      {/* ── Main content ── */}
      <main className="app-main" style={{ flex: 1, paddingBottom: 80, background: 'var(--bg)' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 16px' }}>
          {children}
        </div>
      </main>

      {/* ── Mobile bottom nav — 6 items including Account ── */}
      <nav className="mobile-nav" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
        background: 'var(--sidebar-bg)', borderTop: '1px solid var(--sidebar-border)',
        display: 'grid', gridTemplateColumns: `repeat(${MOBILE_NAV.length}, 1fr)`,
      }}>
        {MOBILE_NAV.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link key={item.href} href={item.href} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              padding: '10px 2px', fontSize: 8, fontWeight: 500,
              textTransform: 'uppercase', letterSpacing: '0.06em', textDecoration: 'none',
              background: active ? 'var(--nav-active-bg)' : 'transparent',
              color: active ? 'var(--nav-active-fg)' : 'var(--sidebar-muted)',
              transition: 'background 0.1s, color 0.1s',
            }}>
              {item.icon}
              {item.label}
            </Link>
          )
        })}
      </nav>

      <style>{`
        @media (min-width: 1024px) {
          .lg-sidebar     { display: flex !important; }
          .mobile-header  { display: none !important; }
          .mobile-nav     { display: none !important; }
          .app-main       { margin-left: 190px; padding-bottom: 48px !important; }
        }
        @media (max-width: 1023px) {
          .app-main > div { padding: 16px 14px !important; }
        }
      `}</style>
    </div>
  )
}
