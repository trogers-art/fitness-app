'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const STEPS = ['basics', 'body', 'goal'] as const
type Step = typeof STEPS[number]
type Units = 'imperial' | 'metric'

const ACTIVITY_LABELS = {
  sedentary:   'Sedentary — desk job, little exercise',
  light:       'Light — 1–3 days exercise/week',
  moderate:    'Moderate — 3–5 days exercise/week',
  active:      'Active — 6–7 days exercise/week',
  very_active: 'Very active — physical job + training',
}

const GOAL_LABELS = {
  fat_loss:    { label: 'Lose fat',     desc: 'Burn fat while preserving muscle' },
  muscle_gain: { label: 'Build muscle', desc: 'Lean bulk with strength focus' },
  maintain:    { label: 'Maintain',     desc: 'Hold current weight and fitness' },
}

const lbsToKg   = (lbs: number)                    => Math.round(lbs * 0.453592 * 10) / 10
const feetInToCm = (feet: number, inches: number)  => Math.round((feet * 30.48) + (inches * 2.54))

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()

  const [step,    setStep]    = useState<Step>('basics')
  const [units,   setUnits]   = useState<Units>('imperial')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const [form, setForm] = useState({
    age:           '',
    sex:           'male' as 'male' | 'female',
    // imperial
    feet:          '',
    inches:        '',
    weight_lbs:    '',
    // metric
    height_cm:     '',
    weight_kg:     '',
    // shared
    activity_level: 'moderate',
    goal:           'fat_loss',
    // rate in display units (lbs/wk or kg/wk)
    target_rate:    units === 'imperial' ? '1' : '0.5',
  })

  const update = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }))

  const stepIndex = STEPS.indexOf(step)

  function switchUnits(u: Units) {
    setUnits(u)
    setForm(f => ({ ...f, target_rate: u === 'imperial' ? '1' : '0.5' }))
  }

  async function handleSubmit() {
    setLoading(true)
    setError(null)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setError('Session expired. Please sign in again.')
      setLoading(false)
      router.push('/login')
      return
    }

    // Normalise to metric for storage
    const height_cm = units === 'imperial'
      ? feetInToCm(parseInt(form.feet), parseInt(form.inches || '0'))
      : parseFloat(form.height_cm)

    const weight_kg = units === 'imperial'
      ? lbsToKg(parseFloat(form.weight_lbs))
      : parseFloat(form.weight_kg)

    const target_rate_kg_per_week = units === 'imperial'
      ? Math.round(parseFloat(form.target_rate) * 0.453592 * 100) / 100
      : parseFloat(form.target_rate)

    const payload = {
      age:      parseInt(form.age),
      sex:      form.sex,
      height_cm,
      weight_kg,
      activity_level: form.activity_level,
      goal:           form.goal,
      target_rate_kg_per_week,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      units,
    }

    const res = await fetch('/api/ai/metrics', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
      credentials: 'include',
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Something went wrong. Please try again.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  // Loss rate options per unit system
  const rateOptions = units === 'imperial'
    ? [['0.5', 'Slow\n0.5 lbs/wk'], ['1', 'Moderate\n1 lb/wk'], ['1.5', 'Aggressive\n1.5 lbs/wk']]
    : [['0.25', 'Slow\n0.25 kg/wk'], ['0.5', 'Moderate\n0.5 kg/wk'], ['0.75', 'Aggressive\n0.75 kg/wk']]

  const bodyValid = units === 'imperial'
    ? !!form.feet && !!form.weight_lbs
    : !!form.height_cm && !!form.weight_kg

  return (
    <div className="card p-8">
      {/* Progress */}
      <div className="flex gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex-1">
            <div className={`h-2 rounded-full transition-all ${i <= stepIndex ? 'bg-brand-500' : 'bg-gray-100'}`} />
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">{error}</div>
      )}

      {/* ── Step 1: basics ── */}
      {step === 'basics' && (
        <div className="space-y-5">
          <h2 className="text-xl font-semibold">Tell us about yourself</h2>

          {/* Units toggle */}
          <div>
            <label className="label">Units</label>
            <div className="grid grid-cols-2 gap-3">
              {(['imperial', 'metric'] as Units[]).map(u => (
                <button key={u} onClick={() => switchUnits(u)}
                  className={`py-2.5 rounded-xl border text-sm font-medium transition-all capitalize ${units === u ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  {u === 'imperial' ? '🇺🇸 Imperial (lbs, ft)' : '🌍 Metric (kg, cm)'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Age</label>
            <input className="input" type="number" min={13} max={100}
              value={form.age} onChange={e => update('age', e.target.value)} placeholder="32" />
          </div>

          <div>
            <label className="label">Sex</label>
            <div className="grid grid-cols-2 gap-3">
              {(['male', 'female'] as const).map(s => (
                <button key={s} onClick={() => update('sex', s)}
                  className={`py-3 rounded-xl border text-sm font-medium transition-all capitalize ${form.sex === s ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Activity level</label>
            <div className="space-y-2">
              {Object.entries(ACTIVITY_LABELS).map(([val, label]) => (
                <button key={val} onClick={() => update('activity_level', val)}
                  className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${form.activity_level === val ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <button className="btn-primary w-full" disabled={!form.age} onClick={() => setStep('body')}>
            Continue
          </button>
        </div>
      )}

      {/* ── Step 2: body ── */}
      {step === 'body' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Your measurements</h2>
            <span className="text-xs text-gray-400 capitalize">{units}</span>
          </div>

          {units === 'imperial' ? (
            <>
              <div>
                <label className="label">Height</label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <input className="input pr-10" type="number" min={3} max={8}
                      value={form.feet} onChange={e => update('feet', e.target.value)} placeholder="5" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">ft</span>
                  </div>
                  <div className="relative">
                    <input className="input pr-10" type="number" min={0} max={11}
                      value={form.inches} onChange={e => update('inches', e.target.value)} placeholder="10" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">in</span>
                  </div>
                </div>
              </div>
              <div>
                <label className="label">Weight</label>
                <div className="relative">
                  <input className="input pr-12" type="number" min={60} max={700} step="0.1"
                    value={form.weight_lbs} onChange={e => update('weight_lbs', e.target.value)} placeholder="180" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">lbs</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="label">Height</label>
                <div className="relative">
                  <input className="input pr-10" type="number" min={100} max={250}
                    value={form.height_cm} onChange={e => update('height_cm', e.target.value)} placeholder="175" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">cm</span>
                </div>
              </div>
              <div>
                <label className="label">Weight</label>
                <div className="relative">
                  <input className="input pr-10" type="number" min={30} max={300} step="0.1"
                    value={form.weight_kg} onChange={e => update('weight_kg', e.target.value)} placeholder="80" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">kg</span>
                </div>
              </div>
            </>
          )}

          <div className="flex gap-3">
            <button className="btn-secondary flex-1" onClick={() => setStep('basics')}>Back</button>
            <button className="btn-primary flex-1" disabled={!bodyValid} onClick={() => setStep('goal')}>
              Continue
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: goal ── */}
      {step === 'goal' && (
        <div className="space-y-5">
          <h2 className="text-xl font-semibold">What&apos;s your goal?</h2>

          <div className="space-y-3">
            {Object.entries(GOAL_LABELS).map(([val, { label, desc }]) => (
              <button key={val} onClick={() => update('goal', val)}
                className={`w-full text-left px-4 py-4 rounded-xl border transition-all ${form.goal === val ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <div className={`font-medium text-sm ${form.goal === val ? 'text-brand-700' : 'text-gray-900'}`}>{label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
              </button>
            ))}
          </div>

          {form.goal === 'fat_loss' && (
            <div>
              <label className="label">Weekly loss target</label>
              <div className="grid grid-cols-3 gap-2">
                {rateOptions.map(([val, text]) => (
                  <button key={val} onClick={() => update('target_rate', val)}
                    className={`py-3 px-2 rounded-xl border text-xs text-center transition-all whitespace-pre-line ${form.target_rate === val ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                    {text}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button className="btn-secondary flex-1" onClick={() => setStep('body')}>Back</button>
            <button className="btn-primary flex-1" disabled={loading} onClick={handleSubmit}>
              {loading ? 'Building your plan…' : 'Get my plan'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
