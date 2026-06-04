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

// Hardcoded — onboarding always light, no theme dependency
const C = {
  bg:           '#f4f4f2',
  surface:      '#ffffff',
  border:       '#e2e2de',
  borderActive: '#1a1c1e',
  activeBg:    '#1a1c1e',
  activeFg:     '#ffffff',
  text:         '#111111',
  textSub:      '#666660',
  textMuted:    '#aaaaaa',
  red:          '#d93025',
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

  const update  = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }))
  const stepIdx = STEPS.indexOf(step)

  const rateOptions = units === 'imperial'
    ? [['0.5','Slow\n0.5 lbs/wk'],['1','Moderate\n1 lb/wk'],['1.5','Aggressive\n1.5 lbs/wk']]
    : [['0.25','Slow\n0.25 kg/wk'],['0.5','Moderate\n0.5 kg/wk'],['0.75','Aggressive\n0.75 kg/wk']]

  const bodyValid = units === 'imperial'
    ? !!form.feet && !!form.weight_lbs
    : !!form.height_cm && !!form.weight_kg

  async function handleSubmit() {
    setLoading(true)
    setError(null)

    let session = null
    for (let i = 0; i < 3; i++) {
      const { data } = await supabase.auth.getSession()
      if (data.session) { session = data.session; break }
      await new Promise(r => setTimeout(r, 500))
    }
    if (!session) {
      setError('Session expired. Please sign in again.')
      setLoading(false)
      router.push('/login')
      return
    }

    const height_cm = units === 'imperial'
      ? feetInToCm(parseInt(form.feet), parseInt(form.inches || '0'))
      : parseFloat(form.height_cm)
    const weight_kg = units === 'imperial'
      ? lbsToKg(parseFloat(form.weight_lbs))
      : parseFloat(form.weight_kg)
    const target_rate_kg_per_week = units === 'imperial'
      ? Math.round(parseFloat(form.target_rate) * 0.453592 * 100) / 100
      : parseFloat(form.target_rate)

    const res = await fetch('/api/ai/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        age: parseInt(form.age), sex: form.sex,
        height_cm, weight_kg, activity_level: form.activity_level,
        goal: form.goal, target_rate_kg_per_week, units,
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

  // Button styles — hardcoded, no CSS vars
  const pill = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '10px 0', fontSize: 12, fontWeight: 500,
    border: `1px solid ${active ? C.borderActive : C.border}`,
    background: active ? C.activeBg : C.surface,
    color: active ? C.activeFg : C.textSub,
    cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
    transition: 'all 0.12s',
  })

  const row = (active: boolean): React.CSSProperties => ({
    width: '100%', textAlign: 'left', padding: '12px 14px',
    border: `1px solid ${active ? C.borderActive : C.border}`,
    background: active ? C.activeBg : C.surface,
    cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    transition: 'all 0.12s', marginBottom: 4,
  })

  const label: React.CSSProperties = {
    fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.14em',
    color: C.textMuted, fontWeight: 600, display: 'block', marginBottom: 8,
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 20px 80px' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Wordmark */}
        <p style={{ fontSize: 9, letterSpacing: '0.28em', textTransform: 'uppercase', color: C.textMuted, fontWeight: 600, marginBottom: 32 }}>FitApp</p>

        {/* Progress */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 32 }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ flex: 1, height: 2, background: i <= stepIdx ? C.text : C.border, transition: 'background 0.2s' }} />
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding: '10px 14px', border: `1px solid ${C.red}`, color: C.red, fontSize: 12, marginBottom: 20 }}>
            {error}
          </div>
        )}

        {/* ── Step 1: basics ── */}
        {step === 'basics' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: C.text, margin: 0 }}>Tell us about yourself</h2>

            <div>
              <span style={label}>Units</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button style={pill(units === 'imperial')} onClick={() => setUnits('imperial')}>Imperial (lbs, ft)</button>
                <button style={pill(units === 'metric')} onClick={() => setUnits('metric')}>Metric (kg, cm)</button>
              </div>
            </div>

            <div>
              <span style={label}>Age</span>
              <input type="number" min={13} max={100} value={form.age}
                onChange={e => update('age', e.target.value)} placeholder="32"
                style={{ width: '100%', padding: '11px 14px', border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 14, fontFamily: 'DM Mono, monospace', outline: 'none' }} />
            </div>

            <div>
              <span style={label}>Sex</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['male','female'] as const).map(s => (
                  <button key={s} style={{ ...pill(form.sex === s), textTransform: 'capitalize' }} onClick={() => update('sex', s)}>{s}</button>
                ))}
              </div>
            </div>

            <div>
              <span style={label}>Activity level</span>
              <div>
                {ACTIVITY_OPTIONS.map(o => (
                  <button key={o.value} style={row(form.activity_level === o.value)} onClick={() => update('activity_level', o.value)}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 500, color: form.activity_level === o.value ? C.activeFg : C.text, margin: 0 }}>{o.label}</p>
                      <p style={{ fontSize: 11, color: form.activity_level === o.value ? 'rgba(255,255,255,0.6)' : C.textMuted, margin: '2px 0 0' }}>{o.desc}</p>
                    </div>
                    {form.activity_level === o.value && (
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ color: C.activeFg, flexShrink: 0 }}>
                        <path d="M1.5 6.5l3 3 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/>
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <button disabled={!form.age} onClick={() => setStep('body')}
              style={{ width: '100%', padding: '12px', background: C.activeBg, color: C.activeFg, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', opacity: !form.age ? 0.4 : 1 }}>
              Continue
            </button>
          </div>
        )}

        {/* ── Step 2: body ── */}
        {step === 'body' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: C.text, margin: 0 }}>Your measurements</h2>

            {units === 'imperial' ? (
              <>
                <div>
                  <span style={label}>Height</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[['feet','ft','5'],['inches','in','10']].map(([field,unit,ph]) => (
                      <div key={field} style={{ flex: 1, position: 'relative' }}>
                        <input type="number" value={form[field as keyof typeof form]}
                          onChange={e => update(field, e.target.value)} placeholder={ph}
                          style={{ width: '100%', padding: '11px 36px 11px 14px', border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 14, fontFamily: 'DM Mono, monospace', outline: 'none' }} />
                        <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: C.textMuted }}>{unit}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <span style={label}>Weight</span>
                  <div style={{ position: 'relative' }}>
                    <input type="number" min={60} max={700} step="0.1" value={form.weight_lbs}
                      onChange={e => update('weight_lbs', e.target.value)} placeholder="180"
                      style={{ width: '100%', padding: '11px 48px 11px 14px', border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 14, fontFamily: 'DM Mono, monospace', outline: 'none' }} />
                    <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: C.textMuted }}>lbs</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <span style={label}>Height</span>
                  <div style={{ position: 'relative' }}>
                    <input type="number" min={100} max={250} value={form.height_cm}
                      onChange={e => update('height_cm', e.target.value)} placeholder="175"
                      style={{ width: '100%', padding: '11px 40px 11px 14px', border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 14, fontFamily: 'DM Mono, monospace', outline: 'none' }} />
                    <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: C.textMuted }}>cm</span>
                  </div>
                </div>
                <div>
                  <span style={label}>Weight</span>
                  <div style={{ position: 'relative' }}>
                    <input type="number" min={30} max={300} step="0.1" value={form.weight_kg}
                      onChange={e => update('weight_kg', e.target.value)} placeholder="80"
                      style={{ width: '100%', padding: '11px 40px 11px 14px', border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 14, fontFamily: 'DM Mono, monospace', outline: 'none' }} />
                    <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: C.textMuted }}>kg</span>
                  </div>
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setStep('basics')}
                style={{ flex: 1, padding: '12px', background: C.surface, color: C.text, border: `1px solid ${C.border}`, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                Back
              </button>
              <button disabled={!bodyValid} onClick={() => setStep('goal')}
                style={{ flex: 1, padding: '12px', background: C.activeBg, color: C.activeFg, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', opacity: !bodyValid ? 0.4 : 1 }}>
                Continue
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: goal ── */}
        {step === 'goal' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: C.text, margin: 0 }}>What&apos;s your goal?</h2>

            <div>
              {GOAL_OPTIONS.map(o => (
                <button key={o.value} style={row(form.goal === o.value)} onClick={() => update('goal', o.value)}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: form.goal === o.value ? C.activeFg : C.text, margin: 0 }}>{o.label}</p>
                    <p style={{ fontSize: 11, color: form.goal === o.value ? 'rgba(255,255,255,0.6)' : C.textMuted, margin: '2px 0 0' }}>{o.desc}</p>
                  </div>
                  {form.goal === o.value && (
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ color: C.activeFg, flexShrink: 0 }}>
                      <path d="M1.5 6.5l3 3 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/>
                    </svg>
                  )}
                </button>
              ))}
            </div>

            {form.goal === 'fat_loss' && (
              <div>
                <span style={label}>Weekly loss target</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {rateOptions.map(([val, text]) => (
                    <button key={val} onClick={() => update('target_rate', val)} style={{
                      flex: 1, padding: '10px 4px', fontSize: 11, fontWeight: 500,
                      border: `1px solid ${form.target_rate === val ? C.borderActive : C.border}`,
                      background: form.target_rate === val ? C.activeBg : C.surface,
                      color: form.target_rate === val ? C.activeFg : C.textSub,
                      cursor: 'pointer', whiteSpace: 'pre-line', textAlign: 'center',
                      fontFamily: 'DM Sans, sans-serif', transition: 'all 0.12s',
                    }}>{text}</button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setStep('body')}
                style={{ flex: 1, padding: '12px', background: C.surface, color: C.text, border: `1px solid ${C.border}`, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                Back
              </button>
              <button disabled={loading} onClick={handleSubmit}
                style={{ flex: 1, padding: '12px', background: C.activeBg, color: C.activeFg, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', opacity: loading ? 0.6 : 1 }}>
                {loading ? 'Building your plan...' : 'Get my plan'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
