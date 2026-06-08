'use client'

import { useState, useEffect, useRef } from 'react'

interface PlanFood {
  id:       string
  name:     string
  serving:  string
  calories: number
  protein:  number
  carbs:    number
  fat:      number
}

interface MealOption {
  option_key:     string
  label:          string
  total_calories: number
  total_protein:  number
  total_carbs:    number
  total_fat:      number
  foods:          PlanFood[]
}

interface PlanMeal {
  meal_type: string
  label:     string
  options:   MealOption[]
}

interface DayPlan {
  day_of_week:     number
  day_name:        string
  is_training:     boolean
  target_calories: number
  target_protein:  number
  target_carbs:    number
  target_fat:      number
  meals:           PlanMeal[]
}

interface Plan {
  training_days: number[]
  days:          DayPlan[]
  notes:         string
}

interface SavedPlan {
  id:         string
  plan_data:  Plan
  created_at: string
}

interface FoodResult {
  id?: string
  name: string
  brand: string | null
  calories_per_100g: number
  protein_per_100g:  number
  carbs_per_100g:    number
  fat_per_100g:      number
  serving_description?: string | null
  serving_calories?:    number | null
  fs_food_id?:          string | null
  servings_json?:       string | null
}

const DAY_NAMES = ['','Mon','Tue','Wed','Thu','Fri','Sat','Sun']

const S = {
  lbl:  { fontSize: 9, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: 'var(--text-3)', fontWeight: 500 },
  card: { background: 'var(--surface)', border: '1px solid var(--border)' } as React.CSSProperties,
  input: { padding: '4px 8px', background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text)', fontSize: 12, fontFamily: 'DM Mono, monospace', outline: 'none' } as React.CSSProperties,
}

// ── Food Search Modal ──────────────────────────────────────────────────────

function FoodSearch({ onSelect, onClose }: { onSelect: (f: FoodResult) => void; onClose: () => void }) {
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState<FoodResult[]>([])
  const [loading, setLoading] = useState(false)
  const searchRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    setLoading(true)
    clearTimeout(searchRef.current)
    searchRef.current = setTimeout(async () => {
      const res = await fetch(`/api/food/search?q=${encodeURIComponent(query)}`, { credentials: 'include' })
      const data = await res.json()
      setResults(data.foods || [])
      setLoading(false)
    }, 300)
  }, [query])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ width: '100%', maxWidth: 480, background: 'var(--surface)', border: '1px solid var(--border)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', margin: 0 }}>Swap food</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4 }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1 1l11 11M12 1L1 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/></svg>
          </button>
        </div>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <input style={{ ...S.input, width: '100%', padding: '10px 12px', fontSize: 13 }}
            type="text" placeholder="Search foods..." value={query}
            onChange={e => setQuery(e.target.value)} autoFocus />
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading && <p style={{ ...S.lbl, textAlign: 'center', padding: '16px 0' }}>Searching...</p>}
          {results.map((food, i) => {
            const hasServing = food.serving_description && food.serving_calories != null
            return (
              <button key={i} onClick={() => { onSelect(food); onClose() }}
                style={{ width: '100%', textAlign: 'left', padding: '10px 16px', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                <p style={{ fontSize: 13, color: 'var(--text)', margin: 0, fontWeight: 500 }}>{food.name}</p>
                <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '2px 0 0', fontFamily: 'DM Mono, monospace' }}>
                  {hasServing ? `${food.serving_description} · ${food.serving_calories} kcal` : `per 100g · ${food.calories_per_100g} kcal`}
                  {' · '}{food.protein_per_100g}p {food.carbs_per_100g}c {food.fat_per_100g}f
                </p>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Log Meal Modal ─────────────────────────────────────────────────────────

function LogMealModal({ meal, option, onClose, onLogged }: {
  meal:     PlanMeal
  option:   MealOption
  onClose:  () => void
  onLogged: () => void
}) {
  const [checked, setChecked]  = useState<boolean[]>(option.foods.map(() => true))
  const [logging, setLogging]  = useState(false)

  const selected = option.foods.filter((_, i) => checked[i])
  const totals   = selected.reduce((acc, f) => ({
    calories: acc.calories + f.calories,
    protein:  acc.protein  + f.protein,
    carbs:    acc.carbs    + f.carbs,
    fat:      acc.fat      + f.fat,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 })

  const mealType = ['pre_workout','post_workout'].includes(meal.meal_type) ? meal.meal_type : meal.meal_type

  async function handleLog() {
    if (selected.length === 0) return
    setLogging(true)
    await Promise.all(selected.map(food =>
      fetch('/api/food/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          create_food: {
            name: food.name, calories_per_100g: food.calories,
            protein_per_100g: food.protein, carbs_per_100g: food.carbs,
            fat_per_100g: food.fat, source: 'custom',
          },
          meal_type: mealType, quantity_g: 100,
          serving_description: food.serving,
          calories_total: food.calories, protein_total: food.protein,
          carbs_total: food.carbs, fat_total: food.fat,
        }),
      })
    ))
    setLogging(false)
    onLogged()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ width: '100%', maxWidth: 480, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', margin: 0 }}>{meal.label} — {option.label}</p>
            <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '2px 0 0' }}>Uncheck anything you didn&apos;t have</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4 }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1 1l11 11M12 1L1 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/></svg>
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {option.foods.map((food, i) => (
            <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
              <input type="checkbox" checked={checked[i]}
                onChange={() => setChecked(prev => prev.map((v, j) => j === i ? !v : v))}
                style={{ width: 16, height: 16, flexShrink: 0, cursor: 'pointer' }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, color: checked[i] ? 'var(--text)' : 'var(--text-3)', margin: 0, fontWeight: 500 }}>{food.name}</p>
                <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '2px 0 0', fontFamily: 'DM Mono, monospace' }}>{food.serving} · {food.calories} kcal</p>
              </div>
              <div style={{ fontSize: 10, fontFamily: 'DM Mono, monospace', color: 'var(--text-3)', textAlign: 'right', flexShrink: 0 }}>
                {food.protein}p {food.carbs}c {food.fat}f
              </div>
            </label>
          ))}
        </div>
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 14, marginBottom: 10, fontSize: 11, fontFamily: 'DM Mono, monospace' }}>
            <span style={{ color: 'var(--text-2)' }}><b style={{ color: 'var(--text)' }}>{totals.calories}</b> kcal</span>
            <span style={{ color: 'var(--text-3)' }}>{totals.protein}p {totals.carbs}c {totals.fat}f</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '10px', fontSize: 12, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border-2)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Cancel</button>
            <button onClick={handleLog} disabled={logging || selected.length === 0}
              style={{ flex: 2, padding: '10px', fontSize: 12, fontWeight: 600, background: 'var(--btn-bg)', color: 'var(--btn-fg)', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', opacity: (logging || selected.length === 0) ? 0.4 : 1 }}>
              {logging ? 'Logging...' : `Log ${selected.length} item${selected.length !== 1 ? 's' : ''} to diary`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Food Item (editable) ───────────────────────────────────────────────────

function FoodItem({ food, onUpdate, onDelete, onSwap }: {
  food:     PlanFood
  onUpdate: (field: keyof PlanFood, value: any) => void
  onDelete: () => void
  onSwap:   () => void
}) {
  const [editing, setEditing] = useState(false)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, color: 'var(--text)', margin: 0, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{food.name}</p>
        {editing ? (
          <input style={{ ...S.input, marginTop: 4, width: '100%' }} type="text" value={food.serving}
            onChange={e => onUpdate('serving', e.target.value)}
            onBlur={() => setEditing(false)}
            autoFocus />
        ) : (
          <button onClick={() => setEditing(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
            <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '2px 0 0', fontFamily: 'DM Mono, monospace' }}>{food.serving}</p>
          </button>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        <div style={{ fontSize: 10, fontFamily: 'DM Mono, monospace', color: 'var(--text-3)', textAlign: 'right', marginRight: 4 }}>
          <p style={{ margin: 0 }}>{food.calories} kcal</p>
          <p style={{ margin: '1px 0 0' }}>{food.protein}p {food.carbs}c {food.fat}f</p>
        </div>
        <button onClick={onSwap} title="Swap food"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 3 }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1 3h9M7 1l3 2-3 2M10 8H1M4 6l-3 2 3 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="square"/></svg>
        </button>
        <button onClick={onDelete} title="Remove"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 3 }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/></svg>
        </button>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export default function MealPlan() {
  const [plan,        setPlan]        = useState<SavedPlan | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [generating,  setGenerating]  = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<number>(() => {
    const js = new Date().getDay(); return js === 0 ? 7 : js
  })
  const [logTarget,   setLogTarget]   = useState<{ meal: PlanMeal; option: MealOption } | null>(null)
  const [swapTarget,  setSwapTarget]  = useState<{ dayIdx: number; mealIdx: number; optIdx: number; foodIdx: number } | null>(null)
  const [loggedKeys,  setLoggedKeys]  = useState<Set<string>>(new Set())
  const saveTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    fetch('/api/food/meal-plan', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setPlan(d.plan); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // Auto-save plan edits after 1s debounce
  function triggerSave(updatedPlan: SavedPlan) {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      await fetch('/api/food/meal-plan', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ plan_id: updatedPlan.id, plan_data: updatedPlan.plan_data }),
      })
    }, 1000)
  }

  function updatePlan(fn: (p: Plan) => Plan) {
    setPlan(prev => {
      if (!prev) return prev
      const next = { ...prev, plan_data: fn(prev.plan_data) }
      triggerSave(next)
      return next
    })
  }

  function updateFood(dayIdx: number, mealIdx: number, optIdx: number, foodIdx: number, field: keyof PlanFood, value: any) {
    updatePlan(p => {
      const days = p.days.map((d, di) => di !== dayIdx ? d : {
        ...d, meals: d.meals.map((m, mi) => mi !== mealIdx ? m : {
          ...m, options: m.options.map((o, oi) => oi !== optIdx ? o : {
            ...o, foods: o.foods.map((f, fi) => fi !== foodIdx ? f : { ...f, [field]: value })
          })
        })
      })
      return { ...p, days }
    })
  }

  function deleteFood(dayIdx: number, mealIdx: number, optIdx: number, foodIdx: number) {
    updatePlan(p => {
      const days = p.days.map((d, di) => di !== dayIdx ? d : {
        ...d, meals: d.meals.map((m, mi) => mi !== mealIdx ? m : {
          ...m, options: m.options.map((o, oi) => oi !== optIdx ? o : {
            ...o, foods: o.foods.filter((_, fi) => fi !== foodIdx)
          })
        })
      })
      return { ...p, days }
    })
  }

  function swapFood(dayIdx: number, mealIdx: number, optIdx: number, foodIdx: number, newFood: FoodResult) {
    const hasServing = newFood.serving_calories != null
    updatePlan(p => {
      const days = p.days.map((d, di) => di !== dayIdx ? d : {
        ...d, meals: d.meals.map((m, mi) => mi !== mealIdx ? m : {
          ...m, options: m.options.map((o, oi) => oi !== optIdx ? o : {
            ...o, foods: o.foods.map((f, fi) => fi !== foodIdx ? f : {
              id:       f.id,
              name:     newFood.name,
              serving:  hasServing ? newFood.serving_description! : `per 100g`,
              calories: hasServing ? newFood.serving_calories! : newFood.calories_per_100g,
              protein:  hasServing ? (newFood.serving_protein ?? 0) : newFood.protein_per_100g,
              carbs:    hasServing ? (newFood.serving_carbs   ?? 0) : newFood.carbs_per_100g,
              fat:      hasServing ? (newFood.serving_fat     ?? 0) : newFood.fat_per_100g,
            })
          })
        })
      })
      return { ...p, days }
    })
  }

  function addFood(dayIdx: number, mealIdx: number, optIdx: number, newFood: FoodResult) {
    const hasServing = newFood.serving_calories != null
    const food: PlanFood = {
      id:       `manual_${Date.now()}`,
      name:     newFood.name,
      serving:  hasServing ? newFood.serving_description! : 'per 100g',
      calories: hasServing ? newFood.serving_calories! : newFood.calories_per_100g,
      protein:  hasServing ? (newFood.serving_protein ?? 0) : newFood.protein_per_100g,
      carbs:    hasServing ? (newFood.serving_carbs   ?? 0) : newFood.carbs_per_100g,
      fat:      hasServing ? (newFood.serving_fat     ?? 0) : newFood.fat_per_100g,
    }
    updatePlan(p => {
      const days = p.days.map((d, di) => di !== dayIdx ? d : {
        ...d, meals: d.meals.map((m, mi) => mi !== mealIdx ? m : {
          ...m, options: m.options.map((o, oi) => oi !== optIdx ? o : {
            ...o, foods: [...o.foods, food]
          })
        })
      })
      return { ...p, days }
    })
  }

  const [genProgress, setGenProgress] = useState<string | null>(null)

  async function handleGenerate() {
    setGenerating(true)
    setError(null)
    setGenProgress('Starting...')

    // Reset plan to empty while generating
    setPlan(null)

    const res = await fetch('/api/food/meal-plan', { method: 'POST', credentials: 'include' })
    if (!res.ok || !res.body) { setError('Generation failed'); setGenerating(false); return }

    const reader  = res.body.getReader()
    const decoder = new TextDecoder()
    let planId: string | null  = null
    let notes:  string         = ''
    const days: any[]          = []

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value)
      const lines = chunk.split('
')

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        try {
          const event = JSON.parse(line.slice(6))

          if (event.type === 'progress') {
            setGenProgress(`Generating ${event.day_name}...`)
          }
          if (event.type === 'day') {
            days.push(event.data)
            // Show partial plan as days come in
            setPlan(prev => ({
              id:         planId || 'generating',
              created_at: new Date().toISOString(),
              plan_data:  { training_days: event.data.is_training ? [] : [], days: [...days], notes },
            }))
          }
          if (event.type === 'error') {
            console.error('Day gen error:', event.message)
          }
          if (event.type === 'done') {
            planId = event.plan_id
            notes  = event.notes
            // Final plan with correct training_days
            const finalRes = await fetch('/api/food/meal-plan', { credentials: 'include' })
            const finalData = await finalRes.json()
            if (finalData.plan) setPlan(finalData.plan)
            setGenProgress(null)
          }
        } catch { /* skip malformed lines */ }
      }
    }

    setGenerating(false)
    setGenProgress(null)
  }

  if (loading) return <p style={{ ...S.lbl, textAlign: 'center', padding: '40px 0' }}>Loading...</p>

  if (!plan) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ ...S.card, padding: '28px 20px', textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 6px' }}>No meal plan yet.</p>
        <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '0 0 20px', lineHeight: 1.6 }}>
          Claude will generate a 7-day plan with 3 meal options per slot, tailored to your targets and workout schedule.
        </p>
        <button onClick={handleGenerate} disabled={generating}
          style={{ padding: '11px 24px', background: 'var(--btn-bg)', color: 'var(--btn-fg)', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', opacity: generating ? 0.6 : 1 }}>
          {generating ? 'Generating...' : 'Generate 7-day meal plan'}
        </button>
        {generating && <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 12 }}>{genProgress || 'Starting...'}</p>}
        {error && <p style={{ fontSize: 12, color: 'var(--red)', marginTop: 10 }}>{error}</p>}
      </div>
    </div>
  )

  const planData   = plan.plan_data
  const currentDay = planData.days?.find(d => d.day_of_week === selectedDay)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ ...S.lbl, marginBottom: 2 }}>
            7-day plan{plan.created_at && !isNaN(new Date(plan.created_at).getTime())
              ? ` · ${new Date(plan.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })}`
              : ''}
          </p>
          {planData.notes && <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2, maxWidth: 400 }}>{planData.notes}</p>}
        </div>
        <button onClick={handleGenerate} disabled={generating}
          style={{ fontSize: 11, padding: '5px 12px', border: '1px solid var(--border-2)', background: 'none', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', opacity: generating ? 0.5 : 1, flexShrink: 0 }}>
          {generating ? (genProgress || 'Generating...') : 'Regenerate'}
        </button>
      </div>

      {/* Day tabs */}
      <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 2 }}>
        {(planData.days || []).map(day => {
          const isToday   = day.day_of_week === (new Date().getDay() === 0 ? 7 : new Date().getDay())
          const isActive  = day.day_of_week === selectedDay
          return (
            <button key={day.day_of_week} onClick={() => setSelectedDay(day.day_of_week)}
              style={{
                padding: '6px 10px', fontSize: 11, fontWeight: 500, flexShrink: 0,
                border: '1px solid',
                borderColor: isActive ? 'var(--text)' : 'var(--border-2)',
                background: isActive ? 'var(--btn-bg)' : 'transparent',
                color: isActive ? 'var(--btn-fg)' : isToday ? 'var(--text)' : 'var(--text-2)',
                cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
              }}>
              <span>{DAY_NAMES[day.day_of_week]}</span>
              {day.is_training && <span style={{ display: 'block', fontSize: 8, color: isActive ? 'var(--btn-fg)' : 'var(--green)', marginTop: 1 }}>●</span>}
            </button>
          )
        })}
      </div>

      {/* Day header */}
      {currentDay && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{currentDay.day_name}</span>
            <span style={{
              fontSize: 9, padding: '2px 7px', border: '1px solid',
              borderColor: currentDay.is_training ? 'var(--green)' : 'var(--border-2)',
              color: currentDay.is_training ? 'var(--green)' : 'var(--text-3)',
            }}>
              {currentDay.is_training ? 'Training' : 'Rest'}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'DM Mono, monospace' }}>
              {currentDay.target_calories} kcal · {currentDay.target_protein}p {currentDay.target_carbs}c {currentDay.target_fat}f
            </span>
          </div>

          {/* Meals */}
          {currentDay.meals.map((meal, mealIdx) => (
            <div key={mealIdx} style={{ ...S.card, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                <span style={S.lbl}>{meal.label}</span>
              </div>

              {/* Options */}
              {meal.options.map((opt, optIdx) => {
                const logKey = `${selectedDay}-${meal.meal_type}-${opt.option_key}`
                const isLogged = loggedKeys.has(logKey)
                const dayIdx = planData.days.findIndex(d => d.day_of_week === selectedDay)

                return (
                  <div key={optIdx} style={{ borderBottom: optIdx < meal.options.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    {/* Option header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: 'var(--surface-2)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-2)' }}>Option {opt.option_key?.toUpperCase() || optIdx + 1}</span>
                        <span style={{ fontSize: 11, color: 'var(--text)', fontWeight: 500 }}>{opt.label}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 10, fontFamily: 'DM Mono, monospace', color: 'var(--text-3)' }}>{opt.total_calories} kcal</span>
                        <button onClick={() => setLogTarget({ meal, option: opt })}
                          style={{
                            fontSize: 10, padding: '3px 8px', border: '1px solid',
                            borderColor: isLogged ? 'var(--green)' : 'var(--border-2)',
                            color: isLogged ? 'var(--green)' : 'var(--text-2)',
                            background: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                          }}>
                          {isLogged ? 'Logged' : 'Log'}
                        </button>
                      </div>
                    </div>

                    {/* Foods */}
                    {opt.foods.map((food, foodIdx) => (
                      <FoodItem key={food.id || foodIdx} food={food}
                        onUpdate={(field, value) => updateFood(dayIdx, mealIdx, optIdx, foodIdx, field, value)}
                        onDelete={() => deleteFood(dayIdx, mealIdx, optIdx, foodIdx)}
                        onSwap={() => setSwapTarget({ dayIdx, mealIdx, optIdx, foodIdx })}
                      />
                    ))}

                    {/* Add food to option */}
                    <div style={{ padding: '6px 14px' }}>
                      <button onClick={() => setSwapTarget({ dayIdx, mealIdx, optIdx, foodIdx: -1 })}
                        style={{ fontSize: 10, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', padding: 0 }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}>
                        + Add food
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </>
      )}

      {/* Log meal modal */}
      {logTarget && (
        <LogMealModal
          meal={logTarget.meal}
          option={logTarget.option}
          onClose={() => setLogTarget(null)}
          onLogged={() => {
            const key = `${selectedDay}-${logTarget.meal.meal_type}-${logTarget.option.option_key}`
            setLoggedKeys(prev => new Set([...prev, key]))
            setLogTarget(null)
          }}
        />
      )}

      {/* Swap / Add food modal */}
      {swapTarget && (
        <FoodSearch
          onSelect={food => {
            if (swapTarget.foodIdx === -1) {
              addFood(swapTarget.dayIdx, swapTarget.mealIdx, swapTarget.optIdx, food)
            } else {
              swapFood(swapTarget.dayIdx, swapTarget.mealIdx, swapTarget.optIdx, swapTarget.foodIdx, food)
            }
            setSwapTarget(null)
          }}
          onClose={() => setSwapTarget(null)}
        />
      )}
    </div>
  )
}
