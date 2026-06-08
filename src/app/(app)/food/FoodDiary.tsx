'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AddFood from './AddFood'
import Recipes from './Recipes'
import MealPlan from './MealPlan'

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'pre_workout' | 'post_workout'
type FoodTab  = 'diary' | 'recipes' | 'plan'

interface Food {
  id: string; name: string; brand: string | null
  calories_per_100g: number; protein_per_100g: number
  carbs_per_100g: number; fat_per_100g: number
}
interface Entry {
  id: string; meal_type: MealType; quantity_g: number; logged_at: string
  serving_description: string | null
  calories_total: number | null; protein_total: number | null
  carbs_total: number | null; fat_total: number | null
  food: Food
}
interface Profile {
  daily_calories: number; protein_g: number; carbs_g: number; fat_g: number; units: string
}

const MEALS: { type: MealType; label: string }[] = [
  { type: 'breakfast', label: 'Breakfast' },
  { type: 'lunch',     label: 'Lunch' },
  { type: 'dinner',   label: 'Dinner' },
  { type: 'snack',     label: 'Snacks' },
  { type: 'pre_workout',  label: 'Pre-workout' },
  { type: 'post_workout', label: 'Post-workout' },
]

const DAYS   = ['S','M','T','W','T','F','S']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function toLocalDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function calcNutrition(entry: Entry) {
  if (entry.calories_total != null) {
    return { calories: entry.calories_total, protein: entry.protein_total??0, carbs: entry.carbs_total??0, fat: entry.fat_total??0 }
  }
  const f = entry.quantity_g / 100
  return {
    calories: Math.round(entry.food.calories_per_100g * f),
    protein:  Math.round(entry.food.protein_per_100g  * f * 10) / 10,
    carbs:    Math.round(entry.food.carbs_per_100g    * f * 10) / 10,
    fat:      Math.round(entry.food.fat_per_100g      * f * 10) / 10,
  }
}

const S = {
  lbl:  { fontSize: 9, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: 'var(--text-3)', fontWeight: 500 },
  card: { background: 'var(--surface)', border: '1px solid var(--border)' } as React.CSSProperties,
}

// ── Calendar modal ─────────────────────────────────────────────────────────

function CalendarModal({
  current, datesWithEntries, onSelect, onClose,
}: { current: string; datesWithEntries: Set<string>; onSelect: (d: string) => void; onClose: () => void }) {
  const [viewing, setViewing] = useState(() => {
    const d = new Date(current + 'T12:00:00')
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [selected, setSelected] = useState(current)

  const today = toLocalDate(new Date())

  function daysInMonth(y: number, m: number) { return new Date(y, m+1, 0).getDate() }
  function firstDow(y: number, m: number) { return new Date(y, m, 1).getDay() }

  const totalDays = daysInMonth(viewing.year, viewing.month)
  const firstDay  = firstDow(viewing.year, viewing.month)
  const cells: (number|null)[] = [...Array(firstDay).fill(null), ...Array.from({length: totalDays}, (_,i) => i+1)]

  function cellDate(day: number) {
    return `${viewing.year}-${String(viewing.month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
  }

  function prevMonth() {
    setViewing(v => v.month === 0 ? { year: v.year-1, month: 11 } : { year: v.year, month: v.month-1 })
  }
  function nextMonth() {
    setViewing(v => v.month === 11 ? { year: v.year+1, month: 0 } : { year: v.year, month: v.month+1 })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', width: '100%', maxWidth: 320 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', padding: 4 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/></svg>
          </button>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{MONTHS[viewing.month]} {viewing.year}</span>
          <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', padding: 4 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/></svg>
          </button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4 }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1 1l11 11M12 1L1 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/></svg>
          </button>
        </div>

        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', padding: '10px 12px 4px' }}>
          {DAYS.map((d,i) => (
            <div key={i} style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-3)', paddingBottom: 4 }}>{d}</div>
          ))}
        </div>

        {/* Days grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', padding: '0 12px 12px', gap: 2 }}>
          {cells.map((day, i) => {
            if (!day) return <div key={i} />
            const dateStr  = cellDate(day)
            const isToday   = dateStr === today
            const isSel     = dateStr === selected
            const hasDot    = datesWithEntries.has(dateStr)
            return (
              <div key={i} onClick={() => setSelected(dateStr)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  cursor: 'pointer', padding: '3px 0',
                }}>
                <div style={{
                  width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: isToday ? 500 : 400,
                  background: isSel ? 'var(--btn-bg)' : 'transparent',
                  color: isSel ? 'var(--btn-fg)' : isToday ? 'var(--text)' : 'var(--text-2)',
                  borderRadius: '50%',
                  border: isToday && !isSel ? '1px solid var(--border-2)' : 'none',
                }}>
                  {day}
                </div>
                {hasDot && (
                  <div style={{ width: 3, height: 3, borderRadius: '50%', background: isSel ? 'var(--btn-fg)' : 'var(--text-3)', marginTop: 1 }} />
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: '9px 0', fontSize: 12, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border-2)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
            Cancel
          </button>
          <button onClick={() => { onSelect(selected); onClose() }}
            style={{ flex: 2, padding: '9px 0', fontSize: 12, fontWeight: 600, background: 'var(--btn-bg)', color: 'var(--btn-fg)', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
            Go to {new Date(selected + 'T12:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' })}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main diary ─────────────────────────────────────────────────────────────

export default function FoodDiary({ profile }: { profile: Profile | null }) {
  const router = useRouter()
  const supabase = createClient()
  const [, startTransition] = useTransition()

  const [tab,          setTab]          = useState<FoodTab>('diary')
  const [date,         setDate]         = useState(() => toLocalDate(new Date()))
  const [entries,      setEntries]      = useState<Entry[]>([])
  const [loading,      setLoading]      = useState(true)
  const [calOpen,      setCalOpen]      = useState(false)
  const [addingTo,     setAddingTo]     = useState<MealType | null>(null)
  const [deleting,     setDeleting]     = useState<string | null>(null)
  const [datesWithEntries, setDatesWithEntries] = useState<Set<string>>(new Set())

  const today = toLocalDate(new Date())

  // Fetch entries for a given date
  const fetchEntries = useCallback(async (d: string) => {
    setLoading(true)
    const { data } = await supabase
      .from('food_entries')
      .select(`
        id, meal_type, quantity_g, logged_at,
        serving_description, calories_total, protein_total, carbs_total, fat_total,
        food:foods ( id, name, brand, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g )
      `)
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '')
      .gte('logged_at', `${d}T00:00:00`)
      .lte('logged_at', `${d}T23:59:59`)
      .order('logged_at', { ascending: true })
    setEntries((data as any) || [])
    setLoading(false)
  }, [supabase])

  // Fetch dates that have entries (for calendar dots) — current month
  const fetchDatesWithEntries = useCallback(async () => {
    const d = new Date(date + 'T12:00:00')
    const start = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`
    const end   = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-31`
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('food_entries')
      .select('logged_at')
      .eq('user_id', user.id)
      .gte('logged_at', `${start}T00:00:00`)
      .lte('logged_at', `${end}T23:59:59`)
    const dates = new Set<string>((data || []).map((e: any) => e.logged_at.split('T')[0]))
    setDatesWithEntries(dates)
  }, [supabase, date])

  useEffect(() => { fetchEntries(date) }, [date, fetchEntries])
  useEffect(() => { fetchDatesWithEntries() }, [date, fetchDatesWithEntries])

  function changeDate(delta: number) {
    const d = new Date(date + 'T12:00:00')
    d.setDate(d.getDate() + delta)
    setDate(toLocalDate(d))
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    await fetch(`/api/food/entries/${id}`, { method: 'DELETE', credentials: 'include' })
    setDeleting(null)
    fetchEntries(date)
  }

  function handleAdded() {
    setAddingTo(null)
    fetchEntries(date)
    fetchDatesWithEntries()
  }

  // Totals
  const totals = entries.reduce((acc, e) => {
    const n = calcNutrition(e)
    return { calories: acc.calories + n.calories, protein: acc.protein + n.protein, carbs: acc.carbs + n.carbs, fat: acc.fat + n.fat }
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 })

  const targets = profile ?? { daily_calories: 2000, protein_g: 150, carbs_g: 200, fat_g: 65 }

  const displayDate = new Date(date + 'T12:00:00')
  const isToday = date === today
  const dateLabel = isToday
    ? 'Today'
    : displayDate.toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Header with date nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={() => changeDate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', padding: '4px 8px' }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L6 8l4 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/></svg>
        </button>

        <button onClick={() => setCalOpen(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center' }}>
          <p style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-3)', margin: '0 0 2px' }}>
            {displayDate.toLocaleDateString('en', { month: 'long', year: 'numeric' })}
          </p>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--page-title)', margin: 0 }}>{dateLabel}</h1>
        </button>

        <button onClick={() => changeDate(1)}
          disabled={date >= today}
          style={{ background: 'none', border: 'none', cursor: date >= today ? 'default' : 'pointer', color: date >= today ? 'var(--text-3)' : 'var(--text-2)', padding: '4px 8px' }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 3l4 5-4 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/></svg>
        </button>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        {([['diary','Diary'],['recipes','Recipes'],['plan','Meal Plan']] as [FoodTab,string][]).map(([t,label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '9px 16px', fontSize: 11, fontWeight: tab === t ? 600 : 400,
            background: 'none', border: 'none', cursor: 'pointer',
            borderBottom: tab === t ? '2px solid var(--btn-bg)' : '2px solid transparent',
            color: tab === t ? 'var(--page-title)' : 'var(--text-3)',
            fontFamily: 'DM Sans, sans-serif', transition: 'color 0.1s',
          }}>{label}</button>
        ))}
      </div>

      {tab === 'recipes' && <Recipes />}

      {tab === 'plan' && <MealPlan />}

      {tab === 'diary' && (
        <>
          {/* Daily summary */}
          <div style={{ ...S.card, padding: '18px 20px' }}>
            <p style={{ ...S.lbl, marginBottom: 12 }}>
              {isToday ? "Today's totals" : `${displayDate.toLocaleDateString('en', { month: 'short', day: 'numeric' })} totals`}
            </p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 14 }}>
              <span style={{ fontSize: 40, fontFamily: 'DM Mono, monospace', fontWeight: 500, lineHeight: 1, color: totals.calories > targets.daily_calories ? 'var(--red)' : 'var(--text)' }}>
                {loading ? '—' : totals.calories.toLocaleString()}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>/ {targets.daily_calories} kcal</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Protein', eaten: totals.protein, target: targets.protein_g, color: 'var(--blue)' },
                { label: 'Carbs',   eaten: totals.carbs,   target: targets.carbs_g,   color: 'var(--amber)' },
                { label: 'Fat',     eaten: totals.fat,     target: targets.fat_g,     color: 'var(--red)' },
              ].map(m => {
                const pct  = Math.min(100, m.target > 0 ? (m.eaten / m.target) * 100 : 0)
                const over = m.eaten > m.target
                return (
                  <div key={m.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={S.lbl}>{m.label}</span>
                      <span style={{ fontSize: 10, fontFamily: 'DM Mono, monospace', color: 'var(--text-2)' }}>
                        <span style={{ color: over ? 'var(--red)' : m.color }}>{Math.round(m.eaten)}g</span>
                        <span style={{ color: 'var(--text-3)' }}> / {m.target}g</span>
                      </span>
                    </div>
                    <div style={{ height: 2, background: 'var(--border-2)' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: over ? 'var(--red)' : m.color, transition: 'width 0.4s' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Meal sections */}
          {loading ? (
            <div style={{ ...S.card, padding: '32px 20px', textAlign: 'center' }}>
              <p style={{ ...S.lbl, marginBottom: 0 }}>Loading...</p>
            </div>
          ) : (
            MEALS.map(meal => {
              const mealEntries = entries.filter(e => e.meal_type === meal.type)
              const mealCals    = mealEntries.reduce((s,e) => s + calcNutrition(e).calories, 0)
              return (
                <div key={meal.type} style={S.card}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: mealEntries.length > 0 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={S.lbl}>{meal.label}</span>
                      {mealCals > 0 && <span style={{ fontSize: 10, fontFamily: 'DM Mono, monospace', color: 'var(--text-3)' }}>{mealCals} kcal</span>}
                    </div>
                    <button onClick={() => setAddingTo(meal.type)}
                      style={{ fontSize: 11, color: 'var(--text-3)', background: 'none', border: '1px solid var(--border-2)', padding: '4px 10px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--text)' }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.borderColor = 'var(--border-2)' }}>
                      + Add
                    </button>
                  </div>

                  {mealEntries.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                      {[
                        { label: 'Calories', value: mealCals, color: 'var(--text)', unit: '' },
                        { label: 'Protein',  value: Math.round(mealEntries.reduce((s,e) => s + calcNutrition(e).protein, 0) * 10) / 10, color: 'var(--blue)',  unit: 'g' },
                        { label: 'Carbs',    value: Math.round(mealEntries.reduce((s,e) => s + calcNutrition(e).carbs,   0) * 10) / 10, color: 'var(--amber)', unit: 'g' },
                        { label: 'Fat',      value: Math.round(mealEntries.reduce((s,e) => s + calcNutrition(e).fat,     0) * 10) / 10, color: 'var(--red)',   unit: 'g' },
                      ].map((m, i) => (
                        <div key={m.label} style={{ padding: '7px 14px', borderRight: i < 3 ? '1px solid var(--border)' : 'none' }}>
                          <p style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 500, color: m.color, margin: '0 0 2px' }}>{m.label}</p>
                          <p style={{ fontSize: 15, fontFamily: 'DM Mono, monospace', fontWeight: 500, color: m.color, margin: 0, lineHeight: 1 }}>{m.value}{m.unit}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {mealEntries.map(entry => {
                    const n = calcNutrition(entry)
                    return (
                      <div key={entry.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {entry.food.name}
                          </p>
                          <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '2px 0 0', fontFamily: 'DM Mono, monospace' }}>
                            {entry.serving_description || `${entry.quantity_g}g`} · {n.protein}p {n.carbs}c {n.fat}f
                          </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                          <span style={{ fontSize: 12, fontFamily: 'DM Mono, monospace', color: 'var(--text-2)' }}>{n.calories} kcal</span>
                          <button onClick={() => handleDelete(entry.id)} disabled={deleting === entry.id}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4, opacity: deleting === entry.id ? 0.4 : 1 }}
                            onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}>
                            <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1 1l9 9M10 1L1 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/></svg>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })
          )}
        </>
      )}

      {/* Calendar modal */}
      {calOpen && (
        <CalendarModal
          current={date}
          datesWithEntries={datesWithEntries}
          onSelect={d => setDate(d)}
          onClose={() => setCalOpen(false)}
        />
      )}

      {/* Add food drawer */}
      {addingTo && (
        <AddFood
          mealType={addingTo}
          mealLabel={MEALS.find(m => m.type === addingTo)?.label ?? ''}
          onClose={() => setAddingTo(null)}
          onAdded={handleAdded}
          loggedAt={date}
        />
      )}
    </div>
  )
}
