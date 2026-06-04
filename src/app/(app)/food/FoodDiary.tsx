'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import AddFood from './AddFood'

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'pre_workout' | 'post_workout'

interface Food {
  id: string
  name: string
  brand: string | null
  calories_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
}

interface Entry {
  id: string
  meal_type: MealType
  quantity_g: number
  logged_at: string
  food: Food
}

interface Profile {
  daily_calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  units: string
}

interface Props {
  profile: Profile | null
  entries: Entry[]
  today: string
}

const MEALS: { type: MealType; label: string }[] = [
  { type: 'breakfast',    label: 'Breakfast' },
  { type: 'lunch',        label: 'Lunch' },
  { type: 'dinner',       label: 'Dinner' },
  { type: 'snack',        label: 'Snacks' },
  { type: 'pre_workout',  label: 'Pre-workout' },
  { type: 'post_workout', label: 'Post-workout' },
]

function calcNutrition(entry: Entry) {
  const factor = entry.quantity_g / 100
  return {
    calories: Math.round(entry.food.calories_per_100g * factor),
    protein:  Math.round(entry.food.protein_per_100g  * factor * 10) / 10,
    carbs:    Math.round(entry.food.carbs_per_100g    * factor * 10) / 10,
    fat:      Math.round(entry.food.fat_per_100g      * factor * 10) / 10,
  }
}

const L = {
  lbl:  { fontSize: 9, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: 'var(--text-3)', fontWeight: 500 },
  card: { background: 'var(--surface)', border: '1px solid var(--border)' } as React.CSSProperties,
}

export default function FoodDiary({ profile, entries, today }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [addingTo, setAddingTo] = useState<MealType | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Totals
  const totals = entries.reduce((acc, e) => {
    const n = calcNutrition(e)
    return { calories: acc.calories + n.calories, protein: acc.protein + n.protein, carbs: acc.carbs + n.carbs, fat: acc.fat + n.fat }
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 })

  const targets = profile ?? { daily_calories: 2000, protein_g: 150, carbs_g: 200, fat_g: 65 }

  async function handleDelete(entryId: string) {
    setDeleting(entryId)
    await fetch(`/api/food/entries/${entryId}`, { method: 'DELETE', credentials: 'include' })
    setDeleting(null)
    startTransition(() => router.refresh())
  }

  function handleAdded() {
    setAddingTo(null)
    startTransition(() => router.refresh())
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Header */}
      <div>
        <p style={{ ...L.lbl, marginBottom: 4 }}>
          {new Date(today).toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--page-title)', margin: 0 }}>Food</h1>
      </div>

      {/* Daily summary */}
      <div style={{ ...L.card, padding: '18px 20px' }}>
        <p style={{ ...L.lbl, marginBottom: 14 }}>Today</p>

        {/* Calories */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 14 }}>
          <span style={{ fontSize: 40, fontFamily: 'DM Mono, monospace', fontWeight: 500, lineHeight: 1, color: totals.calories > targets.daily_calories ? 'var(--red)' : 'var(--text)' }}>
            {totals.calories.toLocaleString()}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>/ {targets.daily_calories} kcal</span>
        </div>

        {/* Macro bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { label: 'Protein', eaten: totals.protein, target: targets.protein_g, color: 'var(--blue)' },
            { label: 'Carbs',   eaten: totals.carbs,   target: targets.carbs_g,   color: 'var(--amber)' },
            { label: 'Fat',     eaten: totals.fat,     target: targets.fat_g,     color: 'var(--red)' },
          ].map(m => {
            const pct = Math.min(100, m.target > 0 ? (m.eaten / m.target) * 100 : 0)
            const over = m.eaten > m.target
            return (
              <div key={m.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={L.lbl}>{m.label}</span>
                  <span style={{ fontSize: 10, fontFamily: 'DM Mono, monospace', color: 'var(--text-2)' }}>
                    <span style={{ color: over ? 'var(--red)' : m.color }}>{Math.round(m.eaten)}g</span>
                    <span style={{ color: 'var(--text-3)' }}> / {m.target}g</span>
                  </span>
                </div>
                <div style={{ height: 2, background: 'var(--border-2)' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: over ? 'var(--red)' : m.color, transition: 'width 0.4s ease' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Meal sections */}
      {MEALS.map(meal => {
        const mealEntries = entries.filter(e => e.meal_type === meal.type)
        const mealCals    = mealEntries.reduce((s, e) => s + calcNutrition(e).calories, 0)

        return (
          <div key={meal.type} style={L.card}>
            {/* Meal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: mealEntries.length > 0 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ ...L.lbl, marginBottom: 0 }}>{meal.label}</span>
                {mealCals > 0 && (
                  <span style={{ fontSize: 10, fontFamily: 'DM Mono, monospace', color: 'var(--text-3)' }}>{mealCals} kcal</span>
                )}
              </div>
              <button
                onClick={() => setAddingTo(meal.type)}
                style={{ fontSize: 11, color: 'var(--text-3)', background: 'none', border: '1px solid var(--border-2)', padding: '4px 10px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--text)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.borderColor = 'var(--border-2)' }}>
                + Add
              </button>
            </div>

            {/* Entries */}
            {mealEntries.map(entry => {
              const n = calcNutrition(entry)
              return (
                <div key={entry.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.food.name}
                    </p>
                    <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '2px 0 0', fontFamily: 'DM Mono, monospace' }}>
                      {entry.quantity_g}g &nbsp;·&nbsp; {n.protein}p &nbsp;{n.carbs}c &nbsp;{n.fat}f
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    <span style={{ fontSize: 12, fontFamily: 'DM Mono, monospace', color: 'var(--text-2)' }}>{n.calories} kcal</span>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      disabled={deleting === entry.id}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4, opacity: deleting === entry.id ? 0.4 : 1 }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/>
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}

      {/* Add food drawer */}
      {addingTo && (
        <AddFood
          mealType={addingTo}
          mealLabel={MEALS.find(m => m.type === addingTo)?.label ?? ''}
          onClose={() => setAddingTo(null)}
          onAdded={handleAdded}
        />
      )}
    </div>
  )
}
