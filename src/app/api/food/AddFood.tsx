'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'pre_workout' | 'post_workout'

interface FoodResult {
  id?: string
  name: string
  brand: string | null
  calories_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
  serving_size_g?: number | null
}

interface Props {
  mealType: MealType
  mealLabel: string
  onClose: () => void
  onAdded: () => void
}

type View = 'search' | 'manual'

// Common serving sizes — shown as quick-select chips
const SERVING_PRESETS = [
  { label: '1 serving', g: 100 },
  { label: '½ cup',     g: 118 },
  { label: '1 cup',     g: 236 },
  { label: '1 oz',      g: 28  },
  { label: '1 tbsp',    g: 15  },
  { label: '50g',       g: 50  },
  { label: '150g',      g: 150 },
  { label: '200g',      g: 200 },
]

export default function AddFood({ mealType, mealLabel, onClose, onAdded }: Props) {
  const [view,     setView]     = useState<View>('search')
  const [query,    setQuery]    = useState('')
  const [results,  setResults]  = useState<FoodResult[]>([])
  const [selected, setSelected] = useState<FoodResult | null>(null)
  const [qty,      setQty]      = useState('100')
  const [saving,   setSaving]   = useState(false)
  const searchRef  = useRef<ReturnType<typeof setTimeout>>()

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

    if (view === 'manual') {
      const res = await fetch('/api/food/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          create_food: {
            name: manual.name,
            calories_per_100g: parseFloat(manual.calories),
            protein_per_100g:  parseFloat(manual.protein  || '0'),
            carbs_per_100g:    parseFloat(manual.carbs    || '0'),
            fat_per_100g:      parseFloat(manual.fat      || '0'),
            source: 'custom',
          },
          meal_type: mealType,
          quantity_g: parseFloat(manual.qty),
        }),
      })
      if (res.ok) onAdded(); else setSaving(false)
      return
    }

    if (!selected) { setSaving(false); return }

    const res = await fetch('/api/food/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ food_id: (selected as any).id, meal_type: mealType, quantity_g: parseFloat(qty) }),
    })
    if (res.ok) onAdded(); else setSaving(false)
  }

  const qtyNum = parseFloat(qty) || 0
  const preview = selected && qtyNum > 0 ? {
    calories: Math.round(selected.calories_per_100g * qtyNum / 100),
    protein:  Math.round(selected.protein_per_100g  * qtyNum / 100 * 10) / 10,
    carbs:    Math.round(selected.carbs_per_100g    * qtyNum / 100 * 10) / 10,
    fat:      Math.round(selected.fat_per_100g      * qtyNum / 100 * 10) / 10,
  } : null

  const canAdd = view === 'search'
    ? !!selected && qtyNum > 0
    : !!manual.name && !!manual.calories && parseFloat(manual.qty) > 0

  // Styles
  const S = {
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' } as React.CSSProperties,
    drawer:  { width: '100%', maxWidth: 680, background: 'var(--surface)', border: '1px solid var(--border)', borderBottom: 'none', display: 'flex', flexDirection: 'column', maxHeight: '80vh' } as React.CSSProperties,
    input:   { width: '100%', padding: '10px 12px', background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text)', fontSize: 13, fontFamily: 'DM Mono, monospace', outline: 'none' } as React.CSSProperties,
    lbl:     { fontSize: 9, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: 'var(--text-3)', fontWeight: 500, display: 'block', marginBottom: 6 },
  }

  return (
    <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={S.drawer}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', margin: 0 }}>Add to {mealLabel}</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/></svg>
          </button>
        </div>

        {/* Tab toggle */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {(['search', 'manual'] as View[]).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              flex: 1, padding: '10px 0', fontSize: 11, fontWeight: 500,
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: view === v ? '2px solid var(--text)' : '2px solid transparent',
              color: view === v ? 'var(--text)' : 'var(--text-3)',
              textTransform: 'capitalize', fontFamily: 'DM Sans, sans-serif',
            }}>{v === 'search' ? 'Search' : 'Manual entry'}</button>
          ))}
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* ── Search ── */}
          {view === 'search' && (
            <>
              <input style={S.input} type="text" placeholder="Search foods..."
                value={query} onChange={e => { setQuery(e.target.value); setSelected(null) }} autoFocus />

              {/* Results list */}
              {results.length > 0 && !selected && (
                <div style={{ border: '1px solid var(--border)' }}>
                  {results.map((food, i) => (
                    <button key={i} onClick={() => { setSelected(food); setQuery(food.name); setQty(String(food.serving_size_g && food.serving_size_g > 0 ? food.serving_size_g : 100)) }}
                      style={{ width: '100%', textAlign: 'left', padding: '10px 12px', background: 'none', border: 'none', borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                      <p style={{ fontSize: 13, color: 'var(--text)', margin: 0 }}>{food.name}{food.brand ? <span style={{ color: 'var(--text-3)', fontWeight: 400 }}> · {food.brand}</span> : null}</p>
                      <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '2px 0 0', fontFamily: 'DM Mono, monospace' }}>
                        {food.calories_per_100g} kcal · {food.protein_per_100g}p {food.carbs_per_100g}c {food.fat_per_100g}f per 100g
                      </p>
                    </button>
                  ))}
                </div>
              )}

              {/* Selected food */}
              {selected && (
                <>
                  {/* Selected card */}
                  <div style={{ padding: '10px 12px', background: 'var(--surface-2)', border: '1px solid var(--border-2)' }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', margin: '0 0 2px' }}>{selected.name}</p>
                    <p style={{ fontSize: 10, color: 'var(--text-3)', margin: 0, fontFamily: 'DM Mono, monospace' }}>
                      {selected.calories_per_100g} kcal · {selected.protein_per_100g}p {selected.carbs_per_100g}c {selected.fat_per_100g}f per 100g
                    </p>
                  </div>

                  {/* Quantity */}
                  <div>
                    <label style={S.lbl}>Quantity (g)</label>
                    <input style={S.input} type="number" min={1} max={5000} value={qty}
                      onChange={e => setQty(e.target.value)} />
                  </div>

                  {/* Serving presets */}
                  <div>
                    <label style={S.lbl}>Quick select</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {/* Actual serving size first if available */}
                      {selected?.serving_size_g && selected.serving_size_g > 0 && (
                        <button onClick={() => setQty(String(selected.serving_size_g))}
                          style={{
                            padding: '5px 10px', fontSize: 11, border: '1px solid',
                            borderColor: qty === String(selected.serving_size_g) ? 'var(--text)' : 'var(--accent, #1a1c1e)',
                            background: qty === String(selected.serving_size_g) ? 'var(--btn-bg)' : 'transparent',
                            color: qty === String(selected.serving_size_g) ? 'var(--btn-fg)' : 'var(--text)',
                            cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontWeight: 500,
                          }}>
                          1 serving ({selected.serving_size_g}g)
                        </button>
                      )}
                      {SERVING_PRESETS.map(p => (
                        <button key={p.label} onClick={() => setQty(String(p.g))}
                          style={{
                            padding: '5px 10px', fontSize: 11, border: '1px solid',
                            borderColor: qty === String(p.g) ? 'var(--text)' : 'var(--border-2)',
                            background: qty === String(p.g) ? 'var(--btn-bg)' : 'transparent',
                            color: qty === String(p.g) ? 'var(--btn-fg)' : 'var(--text-2)',
                            cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', transition: 'all 0.1s',
                          }}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Preview */}
                  {preview && (
                    <div style={{ display: 'flex', gap: 16, padding: '10px 12px', background: 'var(--surface-2)', border: '1px solid var(--border-2)' }}>
                      {[
                        { label: 'Calories', value: preview.calories },
                        { label: 'Protein',  value: `${preview.protein}g` },
                        { label: 'Carbs',    value: `${preview.carbs}g` },
                        { label: 'Fat',      value: `${preview.fat}g` },
                      ].map(s => (
                        <div key={s.label}>
                          <p style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-3)', margin: '0 0 2px' }}>{s.label}</p>
                          <p style={{ fontSize: 12, fontFamily: 'DM Mono, monospace', color: 'var(--text)', margin: 0 }}>{s.value}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* ── Manual entry ── */}
          {view === 'manual' && (
            <>
              <div>
                <label style={S.lbl}>Food name</label>
                <input style={S.input} type="text" placeholder="e.g. Chicken breast"
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
                    <label style={S.lbl}>{f.label}</label>
                    <input style={S.input} type="number" min={0} placeholder={f.placeholder}
                      value={manual[f.field as keyof typeof manual]}
                      onChange={e => updateManual(f.field, e.target.value)} />
                  </div>
                ))}
              </div>
              <div>
                <label style={S.lbl}>Quantity (g)</label>
                <input style={S.input} type="number" min={1} value={manual.qty}
                  onChange={e => updateManual('qty', e.target.value)} />
              </div>
              <div>
                <label style={S.lbl}>Quick select</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {SERVING_PRESETS.map(p => (
                    <button key={p.label} onClick={() => updateManual('qty', String(p.g))}
                      style={{
                        padding: '5px 10px', fontSize: 11, border: '1px solid',
                        borderColor: manual.qty === String(p.g) ? 'var(--text)' : 'var(--border-2)',
                        background: manual.qty === String(p.g) ? 'var(--btn-bg)' : 'transparent',
                        color: manual.qty === String(p.g) ? 'var(--btn-fg)' : 'var(--text-2)',
                        cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', transition: 'all 0.1s',
                      }}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px 0', fontSize: 13, fontWeight: 500, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border-2)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
            Cancel
          </button>
          <button onClick={handleAdd} disabled={saving || !canAdd}
            style={{ flex: 2, padding: '11px 0', fontSize: 13, fontWeight: 600, background: 'var(--btn-bg)', color: 'var(--btn-fg)', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', opacity: (saving || !canAdd) ? 0.4 : 1 }}>
            {saving ? 'Adding...' : 'Add to diary'}
          </button>
        </div>
      </div>
    </div>
  )
}
