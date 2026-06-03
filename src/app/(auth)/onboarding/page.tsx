'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const STEPS = ['basics', 'body', 'goal'] as const
type Step = typeof STEPS[number]

const ACTIVITY_LABELS = {
  sedentary:   'Sedentary — desk job, little exercise',
  light:       'Light — 1–3 days exercise/week',
  moderate:    'Moderate — 3–5 days exercise/week',
  active:      'Active — 6–7 days exercise/week',
  very_active: 'Very active — physical job + training',
}

const GOAL_LABELS = {
  fat_loss:     { label: 'Lose fat', desc: 'Burn fat while preserving muscle' },
  muscle_gain:  { label: 'Build muscle', desc: 'Lean bulk with strength focus' },
  maintain:     { label: 'Maintain', desc: 'Hold current weight and fitness' },
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('basics')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    age: '',
    sex: 'male' as 'male' | 'female',
    height_cm: '',
    weight_kg: '',
    activity_level: 'moderate' as string,
    goal: 'fat_loss' as string,
    target_rate_kg_per_week: '0.5',
  })

  const update = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }))

  const stepIndex = STEPS.indexOf(step)

  async function handleSubmit() {
    setLoading(true)
    setError(null)

    const payload = {
      age: parseInt(form.age),
      sex: form.sex,
      height_cm: parseFloat(form.height_cm),
      weight_kg: parseFloat(form.weight_kg),
      activity_level: form.activity_level,
      goal: form.goal,
      target_rate_kg_per_week: parseFloat(form.target_rate_kg_per_week),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }

    const res = await fetch('/api/ai/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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

  return (
    <div className="card p-8">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div className={`h-2 flex-1 rounded-full transition-all ${i <= stepIndex ? 'bg-brand-500' : 'bg-gray-100'}`} />
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">{error}</div>
      )}

      {/* Step: basics */}
      {step === 'basics' && (
        <div className="space-y-5">
          <h2 className="text-xl font-semibold">Tell us about yourself</h2>
          <div>
            <label className="label">Age</label>
            <input className="input" type="number" min={13} max={100} value={form.age} onChange={e => update('age', e.target.value)} placeholder="32" />
          </div>
          <div>
            <label className="label">Sex</label>
            <div className="grid grid-cols-2 gap-3">
              {(['male', 'female'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => update('sex', s)}
                  className={`py-3 rounded-xl border text-sm font-medium transition-all capitalize ${form.sex === s ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Activity level</label>
            <div className="space-y-2">
              {Object.entries(ACTIVITY_LABELS).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => update('activity_level', val)}
                  className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${form.activity_level === val ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <button
            className="btn-primary w-full"
            disabled={!form.age || !form.sex || !form.activity_level}
            onClick={() => setStep('body')}
          >
            Continue
          </button>
        </div>
      )}

      {/* Step: body */}
      {step === 'body' && (
        <div className="space-y-5">
          <h2 className="text-xl font-semibold">Your measurements</h2>
          <div>
            <label className="label">Height (cm)</label>
            <input className="input" type="number" min={100} max={250} value={form.height_cm} onChange={e => update('height_cm', e.target.value)} placeholder="175" />
          </div>
          <div>
            <label className="label">Weight (kg)</label>
            <input className="input" type="number" min={30} max={300} step="0.1" value={form.weight_kg} onChange={e => update('weight_kg', e.target.value)} placeholder="80" />
          </div>
          <div className="flex gap-3">
            <button className="btn-secondary flex-1" onClick={() => setStep('basics')}>Back</button>
            <button
              className="btn-primary flex-1"
              disabled={!form.height_cm || !form.weight_kg}
              onClick={() => setStep('goal')}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step: goal */}
      {step === 'goal' && (
        <div className="space-y-5">
          <h2 className="text-xl font-semibold">What&apos;s your goal?</h2>
          <div className="space-y-3">
            {Object.entries(GOAL_LABELS).map(([val, { label, desc }]) => (
              <button
                key={val}
                onClick={() => update('goal', val)}
                className={`w-full text-left px-4 py-4 rounded-xl border transition-all ${form.goal === val ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}
              >
                <div className={`font-medium text-sm ${form.goal === val ? 'text-brand-700' : 'text-gray-900'}`}>{label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
              </button>
            ))}
          </div>

          {form.goal === 'fat_loss' && (
            <div>
              <label className="label">Weekly loss target</label>
              <div className="grid grid-cols-3 gap-2">
                {[['0.25', 'Slow\n0.25 kg/wk'], ['0.5', 'Moderate\n0.5 kg/wk'], ['0.75', 'Aggressive\n0.75 kg/wk']].map(([val, text]) => (
                  <button
                    key={val}
                    onClick={() => update('target_rate_kg_per_week', val)}
                    className={`py-3 px-2 rounded-xl border text-xs text-center transition-all whitespace-pre-line ${form.target_rate_kg_per_week === val ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                  >
                    {text}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button className="btn-secondary flex-1" onClick={() => setStep('body')}>Back</button>
            <button
              className="btn-primary flex-1"
              disabled={loading || !form.goal}
              onClick={handleSubmit}
            >
              {loading ? 'Building your plan…' : 'Get my plan'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
