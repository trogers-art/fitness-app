'use client'

import { useState, useEffect, useRef } from 'react'

interface PlanFood {
  id: string; name: string; serving: string
  calories: number; protein: number; carbs: number; fat: number
}
interface MealOption {
  option_key: string; label: string
  total_calories: number; total_protein: number; total_carbs: number; total_fat: number
  foods: PlanFood[]
}
interface PlanMeal {
  meal_type: string; label: string; options: MealOption[]
}
interface DayPlan {
  day_of_week: number; day_name: string; is_training: boolean
  target_calories: number; target_protein: number; target_carbs: number; target_fat: number
  meals: PlanMeal[]
}
interface Plan {
  training_days: number[]; days: DayPlan[]; notes: string
}
interface SavedPlan {
  id: string; plan_data: Plan; created_at: string
}
interface FoodResult {
  id?: string; name: string; brand: string | null
  calories_per_100g: number; protein_per_100g: number; carbs_per_100g: number; fat_per_100g: number
  serving_description?: string | null; serving_calories?: number | null
  serving_protein?: number | null; serving_carbs?: number | null; serving_fat?: number | null
}

const DAY_SHORT = ['','Mon','Tue','Wed','Thu','Fri','Sat','Sun']
const MEAL_ORDER = ['breakfast','pre_workout','post_workout','lunch','dinner','snack']

const S = {
  lbl:   { fontSize: 9, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: 'var(--text-3)', fontWeight: 500 },
  card:  { background: 'var(--surface)', border: '1px solid var(--border)' } as React.CSSProperties,
  input: { padding: '4px 8px', background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text)', fontSize: 12, fontFamily: 'DM Mono, monospace', outline: 'none' } as React.CSSProperties,
}

// ── Generation Progress Modal ──────────────────────────────────────────────

const MEAL_TYPES = ['breakfast','lunch','dinner','snack','pre_workout','post_workout']
const MEAL_LABELS: Record<string,string> = {
  breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner',
  snack: 'Snacks', pre_workout: 'Pre-workout', post_workout: 'Post-workout',
}

function GenerationModal({ progress, onClose }: {
  progress: { type: string; label: string; done: boolean }[]
  onClose?: () => void
}) {
  const allDone = progress.length > 0 && progress.every(p => p.done)
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', width: '100%', maxWidth: 360, padding: '24px 28px' }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 4px' }}>
          {allDone ? 'Meal plan ready' : 'Generating your meal plan...'}
        </p>
        <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '0 0 20px' }}>
          {allDone ? '7 days, 2 options per meal' : 'Building one meal type at a time'}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {MEAL_TYPES.map(mt => {
            const item = progress.find(p => p.type === mt)
            const isActive = progress.length > 0 && progress[progress.length-1].type === mt && !progress[progress.length-1].done
            return (
              <div key={mt} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 20, height: 20, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1px solid',
                  borderColor: item?.done ? 'var(--green)' : isActive ? 'var(--text)' : 'var(--border-2)',
                  background: item?.done ? 'var(--green)' : 'transparent',
                }}>
                  {item?.done && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M1.5 5l2.5 2.5 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="square"/>
                    </svg>
                  )}
                  {isActive && (
                    <div style={{ width: 6, height: 6, background: 'var(--text)', borderRadius: '50%', animation: 'pulse 1s infinite' }} />
                  )}
                </div>
                <span style={{ fontSize: 13, color: item?.done ? 'var(--text)' : isActive ? 'var(--text)' : 'var(--text-3)' }}>
                  {MEAL_LABELS[mt]}
                </span>
                {isActive && <span style={{ fontSize: 10, color: 'var(--text-3)', marginLeft: 'auto' }}>Generating...</span>}
              </div>
            )
          })}
        </div>

        {allDone && onClose && (
          <button onClick={onClose}
            style={{ width: '100%', marginTop: 20, padding: '10px', background: 'var(--btn-bg)', color: 'var(--btn-fg)', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
            View meal plan
          </button>
        )}
      </div>
    </div>
  )
}

// ── Food Search ────────────────────────────────────────────────────────────

function FoodSearch({ onSelect, onClose }: { onSelect: (f: FoodResult) => void; onClose: () => void }) {
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState<FoodResult[]>([])
  const [loading, setLoading] = useState(false)
  const ref = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    setLoading(true)
    clearTimeout(ref.current)
    ref.current = setTimeout(async () => {
      const res  = await fetch(`/api/food/search?q=${encodeURIComponent(query)}`, { credentials: 'include' })
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
  meal: PlanMeal; option: MealOption; onClose: () => void; onLogged: () => void
}) {
  const [checked, setChecked] = useState<boolean[]>(option.foods.map(() => true))
  const [logging, setLogging] = useState(false)
  const selected = option.foods.filter((_, i) => checked[i])
  const totals   = selected.reduce((a, f) => ({ calories: a.calories+f.calories, protein: a.protein+f.protein, carbs: a.carbs+f.carbs, fat: a.fat+f.fat }), { calories:0, protein:0, carbs:0, fat:0 })

  async function handleLog() {
    if (!selected.length) return
    setLogging(true)
    await Promise.all(selected.map(food =>
      fetch('/api/food/entries', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          create_food: { name: food.name, calories_per_100g: food.calories, protein_per_100g: food.protein, carbs_per_100g: food.carbs, fat_per_100g: food.fat, source: 'custom' },
          meal_type: meal.meal_type, quantity_g: 100,
          serving_description: food.serving,
          calories_total: food.calories, protein_total: food.protein, carbs_total: food.carbs, fat_total: food.fat,
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
              <input type="checkbox" checked={checked[i]} onChange={() => setChecked(p => p.map((v,j) => j===i?!v:v))}
                style={{ width: 16, height: 16, flexShrink: 0, cursor: 'pointer' }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, color: checked[i] ? 'var(--text)' : 'var(--text-3)', margin: 0, fontWeight: 500 }}>{food.name}</p>
                <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '2px 0 0', fontFamily: 'DM Mono, monospace' }}>{food.serving} · {food.calories} kcal</p>
              </div>
              <div style={{ fontSize: 10, fontFamily: 'DM Mono, monospace', color: 'var(--text-3)', flexShrink: 0 }}>{food.protein}p {food.carbs}c {food.fat}f</div>
            </label>
          ))}
        </div>
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 10, fontSize: 11, fontFamily: 'DM Mono, monospace' }}>
            <span style={{ color: 'var(--text-2)' }}><b style={{ color: 'var(--text)' }}>{totals.calories}</b> kcal</span>
            <span style={{ color: 'var(--text-3)' }}>{totals.protein}p {totals.carbs}c {totals.fat}f</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '10px', fontSize: 12, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border-2)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Cancel</button>
            <button onClick={handleLog} disabled={logging || !selected.length}
              style={{ flex: 2, padding: '10px', fontSize: 12, fontWeight: 600, background: 'var(--btn-bg)', color: 'var(--btn-fg)', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', opacity: (logging||!selected.length)?0.4:1 }}>
              {logging ? 'Logging...' : `Log ${selected.length} item${selected.length!==1?'s':''} to diary`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Food Item (editable) ───────────────────────────────────────────────────

function FoodItem({ food, onUpdate, onDelete, onSwap }: {
  food: PlanFood; onUpdate: (f: keyof PlanFood, v: any) => void; onDelete: () => void; onSwap: () => void
}) {
  const [editing, setEditing] = useState(false)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, color: 'var(--text)', margin: 0, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{food.name}</p>
        {editing ? (
          <input style={{ ...S.input, marginTop: 4, width: '100%' }} type="text" value={food.serving}
            onChange={e => onUpdate('serving', e.target.value)} onBlur={() => setEditing(false)} autoFocus />
        ) : (
          <button onClick={() => setEditing(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '2px 0 0', fontFamily: 'DM Mono, monospace' }}>{food.serving}</p>
          </button>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        <div style={{ fontSize: 10, fontFamily: 'DM Mono, monospace', color: 'var(--text-3)', textAlign: 'right', marginRight: 4 }}>
          <p style={{ margin: 0 }}>{food.calories} kcal</p>
          <p style={{ margin: '1px 0 0' }}>{food.protein}p {food.carbs}c {food.fat}f</p>
        </div>
        <button onClick={onSwap} title="Swap" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 3 }}
          onMouseEnter={e => (e.currentTarget.style.color='var(--text)')} onMouseLeave={e => (e.currentTarget.style.color='var(--text-3)')}>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1 3h9M7 1l3 2-3 2M10 8H1M4 6l-3 2 3 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="square"/></svg>
        </button>
        <button onClick={onDelete} title="Remove" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 3 }}
          onMouseEnter={e => (e.currentTarget.style.color='var(--red)')} onMouseLeave={e => (e.currentTarget.style.color='var(--text-3)')}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/></svg>
        </button>
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function MealPlan() {
  const [plan,        setPlan]        = useState<SavedPlan | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [generating,  setGenerating]  = useState(false)
  const [showModal,   setShowModal]   = useState(false)
  const [genProgress, setGenProgress] = useState<{ type: string; label: string; done: boolean }[]>([])
  const [selectedDay, setSelectedDay] = useState<number>(() => { const j=new Date().getDay(); return j===0?7:j })
  const [logTarget,   setLogTarget]   = useState<{ meal: PlanMeal; option: MealOption }|null>(null)
  const [swapTarget,  setSwapTarget]  = useState<{ dayIdx:number; mealIdx:number; optIdx:number; foodIdx:number }|null>(null)
  const [loggedKeys,  setLoggedKeys]  = useState<Set<string>>(new Set())
  const saveTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    fetch('/api/food/meal-plan', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setPlan(d.plan); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  function triggerSave(updated: SavedPlan) {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      await fetch('/api/food/meal-plan', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ plan_id: updated.id, plan_data: updated.plan_data }),
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

  function updateFood(di: number, mi: number, oi: number, fi: number, field: keyof PlanFood, value: any) {
    updatePlan(p => ({ ...p, days: p.days.map((d,dii) => dii!==di?d:{ ...d, meals: d.meals.map((m,mii) => mii!==mi?m:{ ...m, options: m.options.map((o,oii) => oii!==oi?o:{ ...o, foods: o.foods.map((f,fii) => fii!==fi?f:{ ...f, [field]:value }) }) }) }) }))
  }
  function deleteFood(di: number, mi: number, oi: number, fi: number) {
    updatePlan(p => ({ ...p, days: p.days.map((d,dii) => dii!==di?d:{ ...d, meals: d.meals.map((m,mii) => mii!==mi?m:{ ...m, options: m.options.map((o,oii) => oii!==oi?o:{ ...o, foods: o.foods.filter((_,fii) => fii!==fi) }) }) }) }))
  }
  function swapFood(di: number, mi: number, oi: number, fi: number, nf: FoodResult) {
    const hasS = nf.serving_calories!=null
    const food: PlanFood = { id: `s_${Date.now()}`, name: nf.name, serving: hasS?nf.serving_description!:'per 100g', calories: hasS?nf.serving_calories!:nf.calories_per_100g, protein: hasS?(nf.serving_protein??0):nf.protein_per_100g, carbs: hasS?(nf.serving_carbs??0):nf.carbs_per_100g, fat: hasS?(nf.serving_fat??0):nf.fat_per_100g }
    updatePlan(p => ({ ...p, days: p.days.map((d,dii) => dii!==di?d:{ ...d, meals: d.meals.map((m,mii) => mii!==mi?m:{ ...m, options: m.options.map((o,oii) => oii!==oi?o:{ ...o, foods: o.foods.map((f,fii) => fii!==fi?f:food) }) }) }) }))
  }
  function addFood(di: number, mi: number, oi: number, nf: FoodResult) {
    const hasS = nf.serving_calories!=null
    const food: PlanFood = { id: `a_${Date.now()}`, name: nf.name, serving: hasS?nf.serving_description!:'per 100g', calories: hasS?nf.serving_calories!:nf.calories_per_100g, protein: hasS?(nf.serving_protein??0):nf.protein_per_100g, carbs: hasS?(nf.serving_carbs??0):nf.carbs_per_100g, fat: hasS?(nf.serving_fat??0):nf.fat_per_100g }
    updatePlan(p => ({ ...p, days: p.days.map((d,dii) => dii!==di?d:{ ...d, meals: d.meals.map((m,mii) => mii!==mi?m:{ ...m, options: m.options.map((o,oii) => oii!==oi?o:{ ...o, foods: [...o.foods, food] }) }) }) }))
  }

  async function handleGenerate() {
    setGenerating(true)
    setShowModal(true)
    setGenProgress([])

    const res = await fetch('/api/food/meal-plan', { method: 'POST', credentials: 'include' })
    if (!res.ok || !res.body) { setGenerating(false); return }

    const reader  = res.body.getReader()
    const decoder = new TextDecoder()
    let planId: string|null = null
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        try {
          const event = JSON.parse(line.slice(6))

          if (event.type === 'progress') {
            setGenProgress(prev => [...prev, { type: event.meal_type, label: event.label, done: false }])
          }
          if (event.type === 'meal_done') {
            setGenProgress(prev => prev.map(p => p.type===event.meal_type ? { ...p, done: true } : p))
          }
          if (event.type === 'error') {
            setGenProgress(prev => prev.map(p => p.type===event.meal_type ? { ...p, done: true } : p))
          }
          if (event.type === 'done') {
            planId = event.plan_id
          }
        } catch { /* skip */ }
      }
    }

    setGenerating(false)
  }

  if (loading) return <p style={{ ...S.lbl, textAlign: 'center', padding: '40px 0' }}>Loading...</p>

  if (!plan && !generating) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ ...S.card, padding: '28px 20px', textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 6px' }}>No meal plan yet.</p>
        <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '0 0 20px', lineHeight: 1.6 }}>
          Claude will generate a 7-day plan with 2 meal options per slot, tailored to your targets and workout schedule.
        </p>
        <button onClick={handleGenerate}
          style={{ padding: '11px 24px', background: 'var(--btn-bg)', color: 'var(--btn-fg)', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
          Generate 7-day meal plan
        </button>
      </div>
      {showModal && <GenerationModal progress={genProgress} onClose={() => setShowModal(false)} />}
    </div>
  )

  const planData   = plan?.plan_data
  const currentDay = planData?.days?.find(d => d.day_of_week === selectedDay)
  const orderedMeals = currentDay
    ? MEAL_ORDER.map(mt => currentDay.meals.find(m => m.meal_type === mt)).filter(Boolean) as PlanMeal[]
    : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ ...S.lbl, marginBottom: 2 }}>
            7-day plan{plan?.created_at && !isNaN(new Date(plan.created_at).getTime())
              ? ` · ${new Date(plan.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })}`
              : ''}
          </p>
          {planData?.notes && <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2, maxWidth: 440 }}>{planData.notes}</p>}
        </div>
        <button onClick={handleGenerate} disabled={generating}
          style={{ fontSize: 11, padding: '5px 12px', border: '1px solid var(--border-2)', background: 'none', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', opacity: generating?0.5:1, flexShrink: 0 }}>
          {generating ? 'Generating...' : 'Regenerate'}
        </button>
      </div>

      {/* Day tabs */}
      <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 2 }}>
        {[1,2,3,4,5,6,7].map(dow => {
          const day       = planData?.days?.find(d => d.day_of_week === dow)
          const isToday   = dow === (new Date().getDay()===0?7:new Date().getDay())
          const isActive  = dow === selectedDay
          const hasMeals  = (day?.meals?.length || 0) > 0
          return (
            <button key={dow} onClick={() => setSelectedDay(dow)}
              style={{
                padding: '6px 10px', fontSize: 11, fontWeight: 500, flexShrink: 0,
                border: '1px solid',
                borderColor: isActive ? 'var(--text)' : 'var(--border-2)',
                background: isActive ? 'var(--btn-bg)' : 'transparent',
                color: isActive ? 'var(--btn-fg)' : isToday ? 'var(--text)' : hasMeals ? 'var(--text-2)' : 'var(--text-3)',
                cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
              }}>
              {DAY_SHORT[dow]}
              {day?.is_training && <span style={{ display: 'block', fontSize: 7, color: isActive?'var(--btn-fg)':'var(--green)', marginTop: 1 }}>●</span>}
            </button>
          )
        })}
      </div>

      {/* Day info */}
      {currentDay ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{currentDay.day_name}</span>
            <span style={{ fontSize: 9, padding: '2px 7px', border: '1px solid', borderColor: currentDay.is_training?'var(--green)':'var(--border-2)', color: currentDay.is_training?'var(--green)':'var(--text-3)' }}>
              {currentDay.is_training ? 'Training' : 'Rest'}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'DM Mono, monospace' }}>
              {currentDay.target_calories} kcal · {currentDay.target_protein}p {currentDay.target_carbs}c {currentDay.target_fat}f
            </span>
          </div>

          {orderedMeals.length === 0 && (
            <p style={{ ...S.lbl, textAlign: 'center', padding: '20px 0' }}>Generating meals...</p>
          )}

          {orderedMeals.map((meal, mealIdx) => {
            const dayIdx = planData!.days.findIndex(d => d.day_of_week === selectedDay)
            const realMealIdx = currentDay.meals.findIndex(m => m.meal_type === meal.meal_type)
            return (
              <div key={mealIdx} style={{ ...S.card, overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                  <span style={S.lbl}>{meal.label}</span>
                </div>
                {meal.options.map((opt, optIdx) => {
                  const logKey  = `${selectedDay}-${meal.meal_type}-${opt.option_key}`
                  const isLogged = loggedKeys.has(logKey)
                  return (
                    <div key={optIdx} style={{ borderBottom: optIdx < meal.options.length-1 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: 'var(--surface-2)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)' }}>Option {opt.option_key?.toUpperCase()}</span>
                          <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>{opt.label}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 10, fontFamily: 'DM Mono, monospace', color: 'var(--text-3)' }}>{opt.total_calories} kcal</span>
                          <button onClick={() => setLogTarget({ meal, option: opt })}
                            style={{ fontSize: 10, padding: '3px 8px', border: '1px solid', borderColor: isLogged?'var(--green)':'var(--border-2)', color: isLogged?'var(--green)':'var(--text-2)', background: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                            {isLogged ? 'Logged' : 'Log'}
                          </button>
                        </div>
                      </div>
                      {opt.foods.map((food, foodIdx) => (
                        <FoodItem key={food.id||foodIdx} food={food}
                          onUpdate={(f,v) => updateFood(dayIdx, realMealIdx, optIdx, foodIdx, f, v)}
                          onDelete={() => deleteFood(dayIdx, realMealIdx, optIdx, foodIdx)}
                          onSwap={() => setSwapTarget({ dayIdx, mealIdx: realMealIdx, optIdx, foodIdx })}
                        />
                      ))}
                      <div style={{ padding: '6px 14px' }}>
                        <button onClick={() => setSwapTarget({ dayIdx, mealIdx: realMealIdx, optIdx, foodIdx: -1 })}
                          style={{ fontSize: 10, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', padding: 0 }}
                          onMouseEnter={e => (e.currentTarget.style.color='var(--text)')}
                          onMouseLeave={e => (e.currentTarget.style.color='var(--text-3)')}>
                          + Add food
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </>
      ) : (
        <p style={{ ...S.lbl, textAlign: 'center', padding: '20px 0' }}>
          {generating ? 'Generating...' : 'No meals for this day yet'}
        </p>
      )}

      {/* Modals */}
      {showModal && <GenerationModal progress={genProgress} onClose={() => setShowModal(false)} />}

      {logTarget && (
        <LogMealModal meal={logTarget.meal} option={logTarget.option}
          onClose={() => setLogTarget(null)}
          onLogged={() => { setLoggedKeys(p => new Set([...p, `${selectedDay}-${logTarget.meal.meal_type}-${logTarget.option.option_key}`])); setLogTarget(null) }}
        />
      )}

      {swapTarget && (
        <FoodSearch
          onSelect={food => {
            swapTarget.foodIdx === -1
              ? addFood(swapTarget.dayIdx, swapTarget.mealIdx, swapTarget.optIdx, food)
              : swapFood(swapTarget.dayIdx, swapTarget.mealIdx, swapTarget.optIdx, swapTarget.foodIdx, food)
            setSwapTarget(null)
          }}
          onClose={() => setSwapTarget(null)}
        />
      )}
    </div>
  )
}
