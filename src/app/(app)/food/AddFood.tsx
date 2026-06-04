'use client'

import { useState, useEffect, useRef } from 'react'

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'pre_workout' | 'post_workout'

interface FoodResult {
  id: string
  name: string
  brand: string | null
  calories_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
}

interface Props {
  mealType: MealType
  mealLabel: string
  onClose: () => void
  onAdded: () => void
}

type View = 'search' | 'manual'

export default function AddFood({ mealType, mealLabel, onClose, onAdded }: Props) {
  const [view,     setView]     = useState<View>('search')
  const [query,    setQuery]    = useState('')
  const [results,  setResults]  = useState<FoodResult[]>([])
  const [selected, setSelected] = useState<FoodResult | null>(null)
  const [qty,      setQty]      = useState('100')
  const [loading,  setLoading]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const searchRef  = useRef<ReturnType<typeof setTimeout>>()

  // Manual entry state
  const [manual, setManual] = useState({ name: '', calories: '', protein: '', carbs: '', fat: '', qty: '100' })
  const updateManual = (f: string, v: string) => setManual(p => ({ ...p, [f]: v }))

  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    clearTimeout(searchRef.current)
    searchRef.current = setTimeout(async () => {
      const res = await fetch(`/api/food/search?q=${encodeURIComponent(query)}`, { credentials: 'include' })
      const data = await res.json()
      setResults(data.foods || [])
    }, 300)
  }, [query])

  async function handleAdd() {
    setSaving(true)
    let foodId = selected?.id

    // If manual, create food first
    if (view === 'manual') {
      const res = await fetch('/api/food/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          create_food: {
            name: manual.name,
            calories_per_100g: parseFloat(manual.calories),
            protein_per_100g:  parseFloat(manual.protein),
            carbs_per_100g:    parseFloat(manual.carbs),
            fat_per_100g:      parseFloat(manual.fat),
            source: 'custom',
          },
          meal_type: mealType,
          quantity_g: parseFloat(manual.qty),
        }),
      })
      if (res.ok) { onAdded() } else { setSaving(false) }
      return
    }

    if (!foodId) { setSaving(false); return }

    const res = await fetch('/api/food/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ food_id: foodId, meal_type: mealType, quantity_g: parseFloat(qty) }),
    })
    if (res.ok) { onAdded() } else { setSaving(false) }
  }

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100,
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  }
  const drawer: React.CSSProperties = {
    width: '100%', maxWidth: 680, background: 'var(--surface)',
    border: '1px solid var(--border)', borderBottom: 'none',
    maxHeight: '85vh', display: 'flex', flexDirection: 'column',
  }
  const lbl: React.CSSProperties = {
    fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em',
    color: 'var(--text-3)', fontWeight: 500, display: 'block', marginBottom: 6,
  }
  const input: React.CSSProperties = {
    width: '100%', padding: '10px 12px', background: 'var(--surface-2)',
    border: '1px solid var(--border-2)', color: 'var(--text)', fontSize: 13,
    fontFamily: 'DM Mono, monospace', outline: 'none',
  }

  const canAddSearch = !!selected && parseFloat(qty) > 0
  const canAddManual = !!manual.name && !!manual.calories && parseFloat(manual.qty) > 0

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={drawer}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', margin: 0 }}>Add to {mealLabel}</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/>
            </svg>
          </button>
        </div>

        {/* View toggle */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {(['search','manual'] as View[]).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              flex: 1, padding: '10px 0', fontSize: 11, fontWeight: 500,
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: view === v ? '2px solid var(--text)' : '2px solid transparent',
              color: view === v ? 'var(--text)' : 'var(--text-3)',
              textTransform: 'capitalize', fontFamily: 'DM Sans, sans-serif',
              transition: 'color 0.1s',
            }}>{v === 'search' ? 'Search' : 'Manual entry'}</button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

          {/* ── Search view ── */}
          {view === 'search' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                style={input} type="text" placeholder="Search foods..."
                value={query} onChange={e => { setQuery(e.target.value); setSelected(null) }}
                autoFocus />

              {/* Results */}
              {results.length > 0 && !selected && (
                <div style={{ border: '1px solid var(--border)' }}>
                  {results.map((food, i) => (
                    <button key={food.id} onClick={() => { setSelected(food); setQuery(food.name) }}
                      style={{
                        width: '100%', textAlign: 'left', padding: '10px 12px',
                        background: 'none', border: 'none', borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none',
                        cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                      <p style={{ fontSize: 13, color: 'var(--text)', margin: 0 }}>{food.name}</p>
                      <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '2px 0 0', fontFamily: 'DM Mono, monospace' }}>
                        {food.calories_per_100g} kcal &nbsp;·&nbsp; {food.protein_per_100g}p &nbsp;{food.carbs_per_100g}c &nbsp;{food.fat_per_100g}f &nbsp;(per 100g)
                        {food.brand && ` · ${food.brand}`}
                      </p>
                    </button>
                  ))}
                </div>
              )}

              {/* Selected food + qty */}
              {selected && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ padding: '10px 12px', background: 'var(--surface-2)', border: '1px solid var(--border-2)' }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', margin: '0 0 2px' }}>{selected.name}</p>
                    <p style={{ fontSize: 10, color: 'var(--text-3)', margin: 0, fontFamily: 'DM Mono, monospace' }}>
                      {selected.calories_per_100g} kcal · {selected.protein_per_100g}p {selected.carbs_per_100g}c {selected.fat_per_100g}f per 100g
                    </p>
                  </div>
                  <div>
                    <label style={lbl}>Quantity (g)</label>
                    <input style={input} type="number" min={1} max={5000} value={qty}
                      onChange={e => setQty(e.target.value)} />
                  </div>
                  {/* Preview */}
                  {parseFloat(qty) > 0 && (
                    <div style={{ display: 'flex', gap: 16, padding: '8px 12px', background: 'var(--surface-2)', border: '1px solid var(--border-2)' }}>
                      {[
                        { label: 'Calories', value: Math.round(selected.calories_per_100g * parseFloat(qty) / 100) },
                        { label: 'Protein',  value: `${Math.round(selected.protein_per_100g * parseFloat(qty) / 100 * 10) / 10}g` },
                        { label: 'Carbs',    value: `${Math.round(selected.carbs_per_100g   * parseFloat(qty) / 100 * 10) / 10}g` },
                        { label: 'Fat',      value: `${Math.round(selected.fat_per_100g     * parseFloat(qty) / 100 * 10) / 10}g` },
                      ].map(s => (
                        <div key={s.label}>
                          <p style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-3)', margin: '0 0 2px' }}>{s.label}</p>
                          <p style={{ fontSize: 12, fontFamily: 'DM Mono, monospace', color: 'var(--text)', margin: 0 }}>{s.value}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Manual entry view ── */}
          {view === 'manual' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={lbl}>Food name</label>
                <input style={input} type="text" placeholder="e.g. Chicken breast"
                  value={manual.name} onChange={e => updateManual('name', e.target.value)} autoFocus />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { field: 'calories', label: 'Calories (per 100g)', placeholder: '165' },
                  { field: 'protein',  label: 'Protein g (per 100g)', placeholder: '31' },
                  { field: 'carbs',    label: 'Carbs g (per 100g)',   placeholder: '0' },
                  { field: 'fat',      label: 'Fat g (per 100g)',     placeholder: '3.6' },
                ].map(f => (
                  <div key={f.field}>
                    <label style={lbl}>{f.label}</label>
                    <input style={input} type="number" min={0} placeholder={f.placeholder}
                      value={manual[f.field as keyof typeof manual]}
                      onChange={e => updateManual(f.field, e.target.value)} />
                  </div>
                ))}
              </div>
              <div>
                <label style={lbl}>Quantity (g)</label>
                <input style={input} type="number" min={1} value={manual.qty}
                  onChange={e => updateManual('qty', e.target.value)} />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '11px 0', fontSize: 13, fontWeight: 500,
            background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border-2)',
            cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
          }}>Cancel</button>
          <button onClick={handleAdd} disabled={saving || (view === 'search' ? !canAddSearch : !canAddManual)}
            style={{
              flex: 2, padding: '11px 0', fontSize: 13, fontWeight: 600,
              background: 'var(--btn-bg)', color: 'var(--btn-fg)', border: 'none',
              cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
              opacity: (saving || (view === 'search' ? !canAddSearch : !canAddManual)) ? 0.4 : 1,
            }}>
            {saving ? 'Adding...' : 'Add to diary'}
          </button>
        </div>
      </div>
    </div>
  )
}
