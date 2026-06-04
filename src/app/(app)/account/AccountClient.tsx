'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  email: string
  emailConfirmed: boolean
  profile: {
    goal: string
    units: string
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

const kgToLbs = (kg: number) => Math.round(kg * 2.20462 * 10) / 10
const cmToFtIn = (cm: number) => {
  const totalIn = cm / 2.54
  const ft = Math.floor(totalIn / 12)
  const inches = Math.round(totalIn % 12)
  return `${ft}'${inches}"`
}

export default function AccountClient({ email, emailConfirmed, profile }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [pwForm, setPwForm]     = useState({ current: '', next: '', confirm: '' })
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError]   = useState<string | null>(null)
  const [pwSuccess, setPwSuccess] = useState(false)

  const imperial = profile?.units === 'imperial'

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    if (pwForm.next !== pwForm.confirm) { setPwError('Passwords do not match'); return }
    if (pwForm.next.length < 8) { setPwError('Password must be at least 8 characters'); return }
    setPwLoading(true)
    setPwError(null)

    const { error } = await supabase.auth.updateUser({ password: pwForm.next })
    if (error) { setPwError(error.message); setPwLoading(false); return }
    setPwSuccess(true)
    setPwForm({ current: '', next: '', confirm: '' })
    setPwLoading(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="space-y-8 max-w-lg">
      {/* Header */}
      <div>
        <p className="text-xs uppercase tracking-widest text-[var(--text-3)] mb-1">Account</p>
        <h1 className="text-2xl font-semibold text-[var(--text)]">Settings</h1>
      </div>

      {/* Identity */}
      <section className="card p-6 space-y-4">
        <h2 className="text-xs uppercase tracking-widest text-[var(--text-3)]">Identity</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-[var(--text-2)] mb-1">Email</p>
            <p className="text-sm text-[var(--text)] font-mono">{email}</p>
          </div>
          {emailConfirmed
            ? <span className="tag-green">Confirmed</span>
            : <span className="tag-amber">Unconfirmed</span>
          }
        </div>
        {!emailConfirmed && (
          <p className="text-xs text-[var(--text-2)] border-l-2 border-[var(--amber)] pl-3">
            Check your inbox for a confirmation link.
          </p>
        )}
      </section>

      {/* Computed targets */}
      {profile && (
        <section className="card p-6 space-y-4">
          <h2 className="text-xs uppercase tracking-widest text-[var(--text-3)]">Your targets</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Goal',     value: profile.goal.replace('_', ' ') },
              { label: 'Units',    value: profile.units },
              { label: 'BMR',      value: `${profile.bmr} kcal` },
              { label: 'TDEE',     value: `${profile.tdee} kcal` },
              { label: 'Daily cals', value: `${profile.daily_calories} kcal` },
              { label: 'Protein',  value: `${profile.protein_g}g` },
              { label: 'Carbs',    value: `${profile.carbs_g}g` },
              { label: 'Fat',      value: `${profile.fat_g}g` },
              { label: 'Weight',   value: imperial ? `${kgToLbs(profile.weight_kg)} lbs` : `${profile.weight_kg} kg` },
              { label: 'Height',   value: imperial ? cmToFtIn(profile.height_cm) : `${profile.height_cm} cm` },
            ].map(({ label, value }) => (
              <div key={label} className="border border-[var(--border)] p-3">
                <p className="text-[10px] uppercase tracking-widest text-[var(--text-3)] mb-1">{label}</p>
                <p className="text-sm font-mono text-[var(--text)] capitalize">{value}</p>
              </div>
            ))}
          </div>
          <a href="/onboarding" className="text-xs text-[var(--accent)] hover:underline">
            Recalculate targets
          </a>
        </section>
      )}

      {/* Change password */}
      <section className="card p-6 space-y-4">
        <h2 className="text-xs uppercase tracking-widest text-[var(--text-3)]">Change password</h2>

        {pwSuccess && (
          <div className="px-4 py-3 border border-[var(--accent)] bg-[#00ff8710] text-xs text-[var(--accent)]">
            Password updated.
          </div>
        )}
        {pwError && (
          <div className="px-4 py-3 border border-[var(--red)] bg-[#ff444410] text-xs text-[var(--red)]">
            {pwError}
          </div>
        )}

        <form onSubmit={handlePasswordChange} className="space-y-3">
          <div>
            <label className="label">New password</label>
            <input className="input" type="password" minLength={8}
              value={pwForm.next} onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))}
              placeholder="Min 8 characters" />
          </div>
          <div>
            <label className="label">Confirm new password</label>
            <input className="input" type="password" minLength={8}
              value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
              placeholder="Repeat password" />
          </div>
          <button type="submit" disabled={pwLoading || !pwForm.next || !pwForm.confirm}
            className="btn-primary">
            {pwLoading ? 'Updating...' : 'Update password'}
          </button>
        </form>
      </section>

      {/* Danger zone */}
      <section className="card p-6 space-y-3 border-[var(--red)]" style={{ borderColor: '#ff444430' }}>
        <h2 className="text-xs uppercase tracking-widest text-[var(--red)]">Sign out</h2>
        <p className="text-xs text-[var(--text-2)]">You will be returned to the login screen.</p>
        <button onClick={handleSignOut} className="btn-danger text-sm">
          Sign out
        </button>
      </section>
    </div>
  )
}
