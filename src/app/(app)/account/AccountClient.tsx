'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Theme = 'default' | 'dark' | 'light'

interface Props {
  email: string
  emailConfirmed: boolean
  profile: {
    goal: string
    units: string
    theme: Theme
    daily_calories: number
    protein_g: number
    carbs_g: number
    fat_g: number
    bmr: number
    tdee: number
    weight_kg: number
    height_cm: number
    age: number
    sex: string
    activity_level: string
  } | null
}

const kgToLbs  = (kg: number) => Math.round(kg * 2.20462 * 10) / 10
const cmToFtIn = (cm: number) => {
  const totalIn = cm / 2.54
  const ft = Math.floor(totalIn / 12)
  const inches = Math.round(totalIn % 12)
  return `${ft}'${inches}"`
}

const THEMES: { value: Theme; label: string; description: string }[] = [
  { value: 'default', label: 'Default', description: 'White sidebar, dark main area' },
  { value: 'dark',    label: 'Dark',    description: 'All dark surfaces' },
  { value: 'light',   label: 'Light',   description: 'All light surfaces' },
]

const S = {
  section: { background: 'var(--surface)', border: '1px solid var(--border)', padding: '20px 24px' } as React.CSSProperties,
  sectionLabel: { fontSize: 9, textTransform: 'uppercase' as const, letterSpacing: '0.16em', color: 'var(--text-3)', fontWeight: 600, marginBottom: 16 },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } as React.CSSProperties,
  divider: { height: 1, background: 'var(--border-2)', margin: '14px 0' } as React.CSSProperties,
}

export default function AccountClient({ email, emailConfirmed, profile }: Props) {
  const router   = useRouter()
  const supabase = createClient()
  const imperial = profile?.units === 'imperial'

  const [theme,      setThemeState]  = useState<Theme>(profile?.theme ?? 'default')
  const [pwForm,     setPwForm]      = useState({ next: '', confirm: '' })
  const [pwLoading,  setPwLoading]   = useState(false)
  const [pwError,    setPwError]     = useState<string | null>(null)
  const [pwSuccess,  setPwSuccess]   = useState(false)
  const [themeSaved, setThemeSaved]  = useState(false)

  async function handleThemeChange(t: Theme) {
    setThemeState(t)
    document.documentElement.setAttribute('data-theme', t)
    setThemeSaved(false)
    await fetch('/api/user/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: t }),
      credentials: 'include',
    })
    setThemeSaved(true)
    setTimeout(() => setThemeSaved(false), 2000)
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    if (pwForm.next !== pwForm.confirm) { setPwError('Passwords do not match'); return }
    if (pwForm.next.length < 8) { setPwError('Minimum 8 characters'); return }
    setPwLoading(true)
    setPwError(null)
    const { error } = await supabase.auth.updateUser({ password: pwForm.next })
    if (error) { setPwError(error.message); setPwLoading(false); return }
    setPwSuccess(true)
    setPwForm({ next: '', confirm: '' })
    setPwLoading(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 520 }}>

      {/* Header */}
      <div style={{ marginBottom: 8 }}>
        <p style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--text-3)', marginBottom: 4 }}>Account</p>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--page-title)', margin: 0 }}>Settings</h1>
      </div>

      {/* Identity */}
      <div style={S.section}>
        <p style={S.sectionLabel}>Identity</p>
        <div style={S.row}>
          <div>
            <p style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 4 }}>Email</p>
            <p style={{ fontSize: 13, fontFamily: 'DM Mono, monospace', color: 'var(--text)', margin: 0 }}>{email}</p>
          </div>
          <span className={emailConfirmed ? 'tag-green tag' : 'tag-amber tag'}>
            {emailConfirmed ? 'Confirmed' : 'Unconfirmed'}
          </span>
        </div>
        {!emailConfirmed && (
          <p style={{ fontSize: 11, color: 'var(--text-3)', borderLeft: '2px solid var(--amber)', paddingLeft: 10, marginTop: 12 }}>
            Check your inbox for a confirmation link.
          </p>
        )}
      </div>

      {/* Theme */}
      <div style={S.section}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <p style={{ ...S.sectionLabel, marginBottom: 0 }}>Appearance</p>
          {themeSaved && <span style={{ fontSize: 10, color: 'var(--green)' }}>Saved</span>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {THEMES.map(t => (
            <button key={t.value} onClick={() => handleThemeChange(t.value)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 14px', border: '1px solid',
              borderColor: theme === t.value ? 'var(--dark)' : 'var(--border-2)',
              background: theme === t.value ? 'var(--nav-active-bg)' : 'transparent',
              cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
              fontFamily: 'DM Sans, sans-serif',
            }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 500, color: theme === t.value ? 'var(--nav-active-fg)' : 'var(--text)', margin: '0 0 2px' }}>{t.label}</p>
                <p style={{ fontSize: 11, color: theme === t.value ? 'var(--nav-active-fg)' : 'var(--text-3)', margin: 0, opacity: theme === t.value ? 0.7 : 1 }}>{t.description}</p>
              </div>
              {theme === t.value && (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: 'var(--nav-active-fg)', flexShrink: 0 }}>
                  <path d="M2 7l3.5 3.5 6.5-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Computed targets */}
      {profile && (
        <div style={S.section}>
          <p style={S.sectionLabel}>Your targets</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: 'Goal',        value: profile.goal.replace('_', ' ') },
              { label: 'Units',       value: profile.units },
              { label: 'BMR',         value: `${profile.bmr} kcal` },
              { label: 'TDEE',        value: `${profile.tdee} kcal` },
              { label: 'Daily cals',  value: `${profile.daily_calories} kcal` },
              { label: 'Protein',     value: `${profile.protein_g}g` },
              { label: 'Carbs',       value: `${profile.carbs_g}g` },
              { label: 'Fat',         value: `${profile.fat_g}g` },
              { label: 'Weight',      value: imperial ? `${kgToLbs(profile.weight_kg)} lbs` : `${profile.weight_kg} kg` },
              { label: 'Height',      value: imperial ? cmToFtIn(profile.height_cm) : `${profile.height_cm} cm` },
            ].map(({ label, value }) => (
              <div key={label} style={{ border: '1px solid var(--border-2)', padding: '10px 12px' }}>
                <p style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-3)', marginBottom: 4 }}>{label}</p>
                <p style={{ fontSize: 12, fontFamily: 'DM Mono, monospace', color: 'var(--text)', margin: 0, textTransform: 'capitalize' }}>{value}</p>
              </div>
            ))}
          </div>
          <button onClick={() => router.push('/onboarding')} style={{ marginTop: 12, fontSize: 11, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'DM Sans, sans-serif', textDecoration: 'underline' }}>
            Recalculate targets
          </button>
        </div>
      )}

      {/* Change password */}
      <div style={S.section}>
        <p style={S.sectionLabel}>Change password</p>
        {pwSuccess && (
          <div style={{ padding: '10px 12px', border: '1px solid var(--green)', color: 'var(--green)', fontSize: 12, marginBottom: 14 }}>
            Password updated.
          </div>
        )}
        {pwError && (
          <div style={{ padding: '10px 12px', border: '1px solid var(--red)', color: 'var(--red)', fontSize: 12, marginBottom: 14 }}>
            {pwError}
          </div>
        )}
        <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label className="label">New password</label>
            <input className="input" type="password" minLength={8} value={pwForm.next}
              onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))} placeholder="Min 8 characters" />
          </div>
          <div>
            <label className="label">Confirm password</label>
            <input className="input" type="password" minLength={8} value={pwForm.confirm}
              onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} placeholder="Repeat password" />
          </div>
          <div>
            <button type="submit" disabled={pwLoading || !pwForm.next || !pwForm.confirm} className="btn" style={{ fontSize: 12 }}>
              {pwLoading ? 'Updating...' : 'Update password'}
            </button>
          </div>
        </form>
      </div>

      {/* Sign out */}
      <div style={{ ...S.section, borderColor: '#d9302520' }}>
        <p style={{ ...S.sectionLabel, color: 'var(--red)' }}>Session</p>
        <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14 }}>You will be returned to the login screen.</p>
        <button onClick={handleSignOut} className="btn-danger" style={{ padding: 0, fontSize: 13 }}>Sign out</button>
      </div>
    </div>
  )
}
