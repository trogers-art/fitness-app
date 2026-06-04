'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const STEPS = ['basics', 'body', 'goal'] as const
type Step = typeof STEPS[number]
type Units = 'imperial' | 'metric'

const ACTIVITY_OPTIONS = [
  { value: 'sedentary',   label: 'Sedentary',   desc: 'Desk job, little exercise' },
  { value: 'light',       label: 'Light',        desc: '1–3 days exercise/week' },
  { value: 'moderate',    label: 'Moderate',     desc: '3–5 days exercise/week' },
  { value: 'active',      label: 'Active',       desc: '6–7 days exercise/week' },
  { value: 'very_active', label: 'Very active',  desc: 'Physical job + training' },
]

const GOAL_OPTIONS = [
  { value: 'fat_loss',    label: 'Lose fat',     desc: 'Burn fat while preserving muscle' },
  { value: 'muscle_gain', label: 'Build muscle', desc: 'Lean bulk with strength focus' },
  { value: 'maintain',    label: 'Maintain',     desc: 'Hold current weight and fitness' },
]

const lbsToKg    = (lbs: number) => Math.round(lbs * 0.453592 * 10) / 10
const feetInToCm = (ft: number, inches: number) => Math.round((ft * 30.48) + (inches * 2.54))

const S = {
  page:    { minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 16px' } as React.CSSProperties,
  wrap:    { width: '100%', maxWidth: 400 } as React.CSSProperties,
  wordmark:{ fontSize: 9, letterSpacing: '0.28em', textTransform: 'uppercase' as const, color: 'var(--text-3)', fontWeight: 600, marginBottom: 36 },
  title:   { fontSize: 20, fontWeight: 600, color: 'var(--text)', margin: '0 0 24px' },
  label:   { fontSize: 9, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: 'var(--text-3)', fontWeight: 500, display: 'block', marginBottom: 8 },
  error:   { padding: '10px 14px', border: '1px solid var(--red)', color: 'var(--red)', fontSize: 12, marginBottom: 20 },
}

export default function OnboardingPage() {
  const router   = useRouter()
  const supabase = createClient()
  const [step,    setStep]    = useState<Step>('basics')
  const [units,   setUnits]   = useState<Units>('imperial')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const [form, setForm] = useState({
    age: '', sex: 'male' as 'male' | 'female',
    feet: '', inches: '', weight_lbs: '',
    height_cm: '', weight_kg: '',
    activity_level: 'moderate',
    goal: 'fat_loss',
    target_rate: '1',
  })

  const update = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }))
  const stepIdx = STEPS.indexOf(step)

  const rateOptions = units === 'imperial'
    ? [['0.5','Slow\n0.5 lbs/wk'],['1','Moderate\n1 lb/wk'],['1.5','Aggressive\n1.5 lbs/wk']]
    : [['0.25','Slow\n0.25 kg/wk'],['0.5','Moderate\n0.5 kg/wk'],['0.75','Aggressive\n0.75 kg/wk']]

  const bodyValid = units === 'imperial' ? !!form.feet && !!form.weight_lbs : !!form.height_cm && !!form.weight_kg

  async function handleSubmit() {
    setLoading(true)
    setError(null)

    let session = null
    for (let i = 0; i < 3; i++) {
      const { data } = await supabase.auth.getSession()
      if (data.session) { session = data.session; break }
      await new Promise(r => setTimeout(r, 500))
    }
    if (!session) { setError('Session expired. Please sign in again.'); setLoading(false); router.push('/login'); return }

    const height_cm = units === 'imperial' ? feetInToCm(parseInt(form.feet), parseInt(form.inches || '0')) : parseFloat(form.height_cm)
    const weight_kg = units === 'imperial' ? lbsToKg(parseFloat(form.weight_lbs)) : parseFloat(form.weight_kg)
    const target_rate_kg_per_week = units === 'imperial'
      ? Math.round(parseFloat(form.target_rate) * 0.453592 * 100) / 100
      : parseFloat(form.target_rate)

    const res = await fetch('/api/ai/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        age: parseInt(form.age), sex: form.sex, height_cm, weight_kg,
        activity_level: form.activity_level, goal: form.goal,
        target_rate_kg_per_week, units,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    })

    if (!res.ok) {
      const d = await res.json()
      setError(d.error || 'Something went wrong.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  // ── Shared button style helpers ──
  const optBtn = (active: boolean): React.CSSProperties => ({
    width: '100%', textAlign: 'left', padding: '12px 14px',
    border: '1px solid', borderColor: active ? 'var(--text)' : 'var(--border-2)',
    background: active ? 'var(--nav-active-bg)' : 'transparent',
    cursor: 'pointer', transition: 'all 0.1s', fontFamily: 'DM Sans, sans-serif',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  })

  const unitToggle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '9px 0', fontSize: 12, fontWeight: 500, border: '1px solid',
    borderColor: active ? 'var(--text)' : 'var(--border-2)',
    background: active ? 'var(--nav-active-bg)' : 'transparent',
    color: active ? 'var(--nav-active-fg)' : 'var(--text-2)',
    cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', transition: 'all 0.1s',
  })

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <p style={S.wordmark}>FitApp</p>

        {/* Progress bar */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 32 }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ flex: 1, height: 2, background: i <= stepIdx ? 'var(--text)' : 'var(--border-2)', transition: 'background 0.2s' }} />
          ))}
        </div>

        {error && <div style={S.error}>{error}</div>}

        {/* ── Step 1: basics ── */}
        {step === 'basics' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <h2 style={S.title}>Tell us about yourself</h2>

            <div>
              <label style={S.label}>Units</label>
              <div style={{ display: 'flex', gap: 4 }}>
                <button style={unitToggle(units === 'imperial')} onClick={() => setUnits('imperial')}>Imperial (lbs, ft)</button>
                <button style={unitToggle(units === 'metric')} onClick={() => setUnits('metric')}>Metric (kg, cm)</button>
              </div>
            </div>

            <div>
              <label style={S.label}>Age</label>
              <input className="input" type="number" min={13} max={100} value={form.age}
                onChange={e => update('age', e.target.value)} placeholder="32" />
            </div>

            <div>
              <label style={S.label}>Sex</label>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['male','female'] as const).map(s => (
                  <button key={s} style={{ ...unitToggle(form.sex === s), textTransform: 'capitalize' }} onClick={() => update('sex', s)}>{s}</button>
                ))}
              </div>
            </div>

            <div>
              <label style={S.label}>Activity level</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {ACTIVITY_OPTIONS.map(o => (
                  <button key={o.value} style={optBtn(form.activity_level === o.value)} onClick={() => update('activity_level', o.value)}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 500, color: form.activity_level === o.value ? 'var(--nav-active-fg)' : 'var(--text)', margin: 0 }}>{o.label}</p>
                      <p style={{ fontSize: 11, color: form.activity_level === o.value ? 'var(--nav-active-fg)' : 'var(--text-3)', margin: '2px 0 0', opacity: form.activity_level === o.value ? 0.7 : 1 }}>{o.desc}</p>
                    </div>
                    {form.activity_level === o.value && (
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ color: 'var(--nav-active-fg)', flexShrink: 0 }}>
                        <path d="M1.5 6.5l3 3 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/>
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <button className="btn" disabled={!form.age} onClick={() => setStep('body')} style={{ width: '100%' }}>Continue</button>
          </div>
        )}

        {/* ── Step 2: body ── */}
        {step === 'body' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <h2 style={S.title}>Your measurements</h2>

            {units === 'imperial' ? (
              <>
                <div>
                  <label style={S.label}>Height</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input className="input" type="number" min={3} max={8} value={form.feet}
                        onChange={e => update('feet', e.target.value)} placeholder="5" style={{ paddingRight: 36 }} />
                      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-3)' }}>ft</span>
                    </div>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input className="input" type="number" min={0} max={11} value={form.inches}
                        onChange={e => update('inches', e.target.value)} placeholder="10" style={{ paddingRight: 36 }} />
                      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-3)' }}>in</span>
                    </div>
                  </div>
                </div>
                <div>
                  <label style={S.label}>Weight</label>
                  <div style={{ position: 'relative' }}>
                    <input className="input" type="number" min={60} max={700} step="0.1" value={form.weight_lbs}
                      onChange={e => update('weight_lbs', e.target.value)} placeholder="180" style={{ paddingRight: 44 }} />
                    <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-3)' }}>lbs</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label style={S.label}>Height</label>
                  <div style={{ position: 'relative' }}>
                    <input className="input" type="number" min={100} max={250} value={form.height_cm}
                      onChange={e => update('height_cm', e.target.value)} placeholder="175" style={{ paddingRight: 40 }} />
                    <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-3)' }}>cm</span>
                  </div>
                </div>
                <div>
                  <label style={S.label}>Weight</label>
                  <div style={{ position: 'relative' }}>
                    <input className="input" type="number" min={30} max={300} step="0.1" value={form.weight_kg}
                      onChange={e => update('weight_kg', e.target.value)} placeholder="80" style={{ paddingRight: 40 }} />
                    <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-3)' }}>kg</span>
                  </div>
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" onClick={() => setStep('basics')} style={{ flex: 1, background: 'var(--surface-2)', color: 'var(--text)' }}>Back</button>
              <button className="btn" disabled={!bodyValid} onClick={() => setStep('goal')} style={{ flex: 1 }}>Continue</button>
            </div>
          </div>
        )}

        {/* ── Step 3: goal ── */}
        {step === 'goal' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <h2 style={S.title}>What&apos;s your goal?</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {GOAL_OPTIONS.map(o => (
                <button key={o.value} style={optBtn(form.goal === o.value)} onClick={() => update('goal', o.value)}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: form.goal === o.value ? 'var(--nav-active-fg)' : 'var(--text)', margin: 0 }}>{o.label}</p>
                    <p style={{ fontSize: 11, color: form.goal === o.value ? 'var(--nav-active-fg)' : 'var(--text-3)', margin: '2px 0 0', opacity: form.goal === o.value ? 0.7 : 1 }}>{o.desc}</p>
                  </div>
                  {form.goal === o.value && (
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ color: 'var(--nav-active-fg)', flexShrink: 0 }}>
                      <path d="M1.5 6.5l3 3 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/>
                    </svg>
                  )}
                </button>
              ))}
            </div>

            {form.goal === 'fat_loss' && (
              <div>
                <label style={S.label}>Weekly loss target</label>
                <div style={{ display: 'flex', gap: 4 }}>
                  {rateOptions.map(([val, text]) => (
                    <button key={val} onClick={() => update('target_rate', val)} style={{
                      flex: 1, padding: '10px 4px', fontSize: 11, border: '1px solid',
                      borderColor: form.target_rate === val ? 'var(--text)' : 'var(--border-2)',
                      background: form.target_rate === val ? 'var(--nav-active-bg)' : 'transparent',
                      color: form.target_rate === val ? 'var(--nav-active-fg)' : 'var(--text-2)',
                      cursor: 'pointer', whiteSpace: 'pre-line', textAlign: 'center',
                      fontFamily: 'DM Sans, sans-serif', transition: 'all 0.1s',
                    }}>{text}</button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" onClick={() => setStep('body')} style={{ flex: 1, background: 'var(--surface-2)', color: 'var(--text)' }}>Back</button>
              <button className="btn" disabled={loading} onClick={handleSubmit} style={{ flex: 1 }}>
                {loading ? 'Building your plan...' : 'Get my plan'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
