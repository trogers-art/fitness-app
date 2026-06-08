'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface PlanFood {
  name:     string
  serving:  string
  calories: number
  protein:  number
  carbs:    number
  fat:      number
}

interface PlanMeal {
  meal_type:      string
  label:          string
  total_calories: number
  total_protein:  number
  total_carbs:    number
  total_fat:      number
  foods:          PlanFood[]
}

interface DayPlan {
  total_calories: number
  total_protein:  number
  total_carbs:    number
  total_fat:      number
  meals:          PlanMeal[]
}

interface Plan {
  training_day:  DayPlan
  rest_day:      DayPlan
  training_days: number[]
  notes:         string
}

interface SavedPlan {
  id:         string
  plan_data:  Plan
  created_at: string
}

type DayType = 'training' | 'rest'

const DAY_NAMES = ['','Mon','Tue','Wed','Thu','Fri','Sat','Sun']
const FULL_DAYS = ['','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']

const S = {
  lbl:  { fontSize: 9, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: 'var(--text-3)', fontWeight: 500 },
  card: { background: 'var(--surface)', border: '1px solid var(--border)' } as React.CSSProperties,
}

// ── Log Meal Modal ─────────────────────────────────────────────────────────

function LogMealModal({ meal, onClose, onLogged }: {
  meal: PlanMeal
  onClose: () => void
  onLogged: () => void
}) {
  const [checked, setChecked] = useState<boolean[]>(meal.foods.map(() => true))
  const [logging, setLogging] = useState(false)

  const selectedFoods = meal.foods.filter((_, i) => checked[i])
  const totals = selectedFoods.reduce((acc, f) => ({
    calories: acc.calories + f.calories,
    protein:  acc.protein  + f.protein,
    carbs:    acc.carbs    + f.carbs,
    fat:      acc.fat      + f.fat,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 })

  async function handleLog() {
    if (selectedFoods.length === 0) return
    setLogging(true)

    // Log each selected food as a custom entry
    await Promise.all(selectedFoods.map(food =>
      fetch('/api/food/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          create_food: {
            name:              food.name,
            calories_per_100g: food.calories,
            protein_per_100g:  food.protein,
            carbs_per_100g:    food.carbs,
            fat_per_100g:      food.fat,
            source:            'custom',
          },
          meal_type:           meal.meal_type === 'pre_workout' ? 'pre_workout'
                             : meal.meal_type === 'post_workout' ? 'post_workout'
                             : meal.meal_type,
          quantity_g:          100,
          serving_description: food.serving,
          calories_total:      food.calories,
          protein_total:       food.protein,
          carbs_total:         food.carbs,
          fat_total:           food.fat,
        }),
      })
    ))

    setLogging(false)
    onLogged()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ width: '100%', maxWidth: 480, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', margin: 0 }}>Log {meal.label}</p>
            <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '2px 0 0' }}>Uncheck anything you didn&apos;t have</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4 }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1 1l11 11M12 1L1 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/></svg>
          </button>
        </div>

        {/* Food checklist */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {meal.foods.map((food, i) => (
            <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
              <input type="checkbox" checked={checked[i]}
                onChange={() => setChecked(prev => prev.map((v, j) => j === i ? !v : v))}
                style={{ width: 16, height: 16, flexShrink: 0, cursor: 'pointer', accentColor: 'var(--dark)' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, color: checked[i] ? 'var(--text)' : 'var(--text-3)', margin: 0, fontWeight: 500, transition: 'color 0.1s' }}>{food.name}</p>
                <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '2px 0 0', fontFamily: 'DM Mono, monospace' }}>
                  {food.serving} · {food.calories} kcal
                </p>
              </div>
              <div style={{ fontSize: 10, fontFamily: 'DM Mono, monospace', color: 'var(--text-3)', textAlign: 'right', flexShrink: 0 }}>
                {food.protein}p {food.carbs}c {food.fat}f
              </div>
            </label>
          ))}
        </div>

        {/* Totals + confirm */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 14, marginBottom: 12, fontSize: 11, fontFamily: 'DM Mono, monospace' }}>
            <span style={{ color: 'var(--text-2)' }}><b style={{ color: 'var(--text)' }}>{totals.calories}</b> kcal</span>
            <span style={{ color: 'var(--text-3)' }}>{totals.protein}p {totals.carbs}c {totals.fat}f</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose}
              style={{ flex: 1, padding: '10px', fontSize: 12, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border-2)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
              Cancel
            </button>
            <button onClick={handleLog} disabled={logging || selectedFoods.length === 0}
              style={{ flex: 2, padding: '10px', fontSize: 12, fontWeight: 600, background: 'var(--btn-bg)', color: 'var(--btn-fg)', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', opacity: (logging || selectedFoods.length === 0) ? 0.4 : 1 }}>
              {logging ? 'Logging...' : `Log ${selectedFoods.length} item${selectedFoods.length !== 1 ? 's' : ''} to diary`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export default function MealPlan() {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [plan,       setPlan]       = useState<SavedPlan | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [dayType,    setDayType]    = useState<DayType>(() => {
    const jsDay = new Date().getDay()
    const dow   = jsDay === 0 ? 7 : jsDay
    return dow ? 'training' : 'rest' // default, will update after plan loads
  })
  const [loggingMeal, setLoggingMeal] = useState<PlanMeal | null>(null)
  const [loggedMeals, setLoggedMeals] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/food/meal-plan', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        setPlan(d.plan)
        if (d.plan) {
          // Set day type based on today
          const jsDay = new Date().getDay()
          const dow   = jsDay === 0 ? 7 : jsDay
          const isTraining = d.plan.plan_data.training_days?.includes(dow)
          setDayType(isTraining ? 'training' : 'rest')
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  async function handleGenerate() {
    setGenerating(true)
    setError(null)
    const res = await fetch('/api/food/meal-plan', { method: 'POST', credentials: 'include' })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Generation failed'); setGenerating(false); return }
    setPlan(data.plan)
    const jsDay = new Date().getDay()
    const dow   = jsDay === 0 ? 7 : jsDay
    const isTraining = data.plan.plan_data.training_days?.includes(dow)
    setDayType(isTraining ? 'training' : 'rest')
    setGenerating(false)
  }

  function handleLogged(mealLabel: string) {
    setLoggingMeal(null)
    setLoggedMeals(prev => new Set([...prev, mealLabel]))
    startTransition(() => router.refresh())
  }

  if (loading) return <p style={{ ...S.lbl, textAlign: 'center', padding: '40px 0' }}>Loading...</p>

  // No plan yet
  if (!plan) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ ...S.card, padding: '28px 20px', textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 6px' }}>No meal plan yet.</p>
        <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '0 0 20px', lineHeight: 1.6 }}>
          Claude will generate a personalised training-day and rest-day meal plan based on your targets and active workout program.
        </p>
        <button onClick={handleGenerate} disabled={generating}
          style={{ padding: '11px 24px', background: 'var(--btn-bg)', color: 'var(--btn-fg)', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', opacity: generating ? 0.6 : 1 }}>
          {generating ? 'Generating...' : 'Generate meal plan'}
        </button>
        {generating && <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 12 }}>This takes about 15 seconds...</p>}
        {error && <p style={{ fontSize: 12, color: 'var(--red)', marginTop: 10 }}>{error}</p>}
      </div>
    </div>
  )

  const planData  = plan.plan_data
  const dayPlan   = dayType === 'training' ? planData.training_day : planData.rest_day
  const trainDays = planData.training_days || []
  const restDays  = [1,2,3,4,5,6,7].filter(d => !trainDays.includes(d))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ ...S.lbl, marginBottom: 2 }}>AI-generated{plan.created_at && !isNaN(new Date(plan.created_at).getTime()) ? ` · ${new Date(plan.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}</p>
          {planData.notes && <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{planData.notes}</p>}
        </div>
        <button onClick={handleGenerate} disabled={generating}
          style={{ fontSize: 11, padding: '5px 12px', border: '1px solid var(--border-2)', background: 'none', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', opacity: generating ? 0.5 : 1 }}>
          {generating ? 'Generating...' : 'Regenerate'}
        </button>
      </div>

      {/* Day type toggle */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => setDayType('training')} style={{
          padding: '6px 14px', fontSize: 11, fontWeight: 500, border: '1px solid',
          borderColor: dayType === 'training' ? 'var(--text)' : 'var(--border-2)',
          background: dayType === 'training' ? 'var(--btn-bg)' : 'transparent',
          color: dayType === 'training' ? 'var(--btn-fg)' : 'var(--text-2)',
          cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
        }}>
          Training day
        </button>
        <button onClick={() => setDayType('rest')} style={{
          padding: '6px 14px', fontSize: 11, fontWeight: 500, border: '1px solid',
          borderColor: dayType === 'rest' ? 'var(--text)' : 'var(--border-2)',
          background: dayType === 'rest' ? 'var(--btn-bg)' : 'transparent',
          color: dayType === 'rest' ? 'var(--btn-fg)' : 'var(--text-2)',
          cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
        }}>
          Rest day
        </button>
      </div>

      {/* Day labels */}
      {(trainDays.length > 0 || restDays.length > 0) && (
        <p style={{ fontSize: 10, color: 'var(--text-3)' }}>
          {dayType === 'training'
            ? trainDays.length > 0 ? `Training: ${trainDays.map(d => DAY_NAMES[d]).join(' · ')}` : 'Training days not set in active program'
            : restDays.length > 0  ? `Rest: ${restDays.map(d => DAY_NAMES[d]).join(' · ')}`     : 'No rest days'}
        </p>
      )}

      {/* Macro summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
        {[
          { label: 'Calories', value: dayPlan.total_calories },
          { label: 'Protein',  value: `${dayPlan.total_protein}g` },
          { label: 'Carbs',    value: `${dayPlan.total_carbs}g` },
          { label: 'Fat',      value: `${dayPlan.total_fat}g` },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface-2)', padding: '10px 12px' }}>
            <p style={S.lbl}>{s.label}</p>
            <p style={{ fontSize: 16, fontFamily: 'DM Mono, monospace', fontWeight: 500, color: 'var(--text)', marginTop: 3 }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Meals */}
      {dayPlan.meals.map((meal, mi) => {
        const isLogged = loggedMeals.has(meal.label)
        return (
          <div key={mi} style={{ ...S.card, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={S.lbl}>{meal.label}</span>
                <span style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', color: 'var(--text-3)' }}>{meal.total_calories} kcal</span>
              </div>
              <button onClick={() => setLoggingMeal(meal)}
                style={{
                  fontSize: 11, padding: '4px 10px', border: '1px solid',
                  borderColor: isLogged ? 'var(--green)' : 'var(--border-2)',
                  color: isLogged ? 'var(--green)' : 'var(--text-2)',
                  background: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                }}>
                {isLogged ? 'Logged' : 'Log meal'}
              </button>
            </div>
            {meal.foods.map((food, fi) => (
              <div key={fi} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', borderBottom: fi < meal.foods.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div>
                  <p style={{ fontSize: 13, color: 'var(--text)', margin: 0 }}>{food.name}</p>
                  <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '2px 0 0', fontFamily: 'DM Mono, monospace' }}>{food.serving}</p>
                </div>
                <div style={{ fontSize: 10, fontFamily: 'DM Mono, monospace', color: 'var(--text-3)', textAlign: 'right' }}>
                  <p style={{ margin: 0 }}>{food.calories} kcal</p>
                  <p style={{ margin: '2px 0 0' }}>{food.protein}p {food.carbs}c {food.fat}f</p>
                </div>
              </div>
            ))}
          </div>
        )
      })}

      {/* Log meal modal */}
      {loggingMeal && (
        <LogMealModal
          meal={loggingMeal}
          onClose={() => setLoggingMeal(null)}
          onLogged={() => handleLogged(loggingMeal.label)}
        />
      )}
    </div>
  )
}
