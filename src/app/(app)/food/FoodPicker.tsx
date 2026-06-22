'use client'

import { useState, useEffect, useRef } from 'react'

export interface FoodResult {
  id?: string
  name: string
  brand: string | null
  calories_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
  serving_size_g?: number | null
  serving_description?: string | null
  serving_calories?: number | null
  serving_protein?: number | null
  serving_carbs?: number | null
  serving_fat?: number | null
  servings_json?: string | null
  fs_food_id?: string | null
}

export interface ServingOption {
  serving_id:  string
  description: string
  metric_g:    number
  calories:    number
  protein:     number
  carbs:       number
  fat:         number
  is_default:  boolean
}

export interface PickedFood {
  food:                FoodResult
  serving:             ServingOption | null
  servingQty:          number
  customQty:           number
  // Resolved totals
  quantity_g:          number
  serving_description: string
  calories_total:      number
  protein_total:       number
  carbs_total:         number
  fat_total:           number
  // For server-side food resolution when no DB id exists
  food_id?:            string
  food_name:           string
  food_brand:          string | null
  calories_per_100g:   number
  protein_per_100g:    number
  carbs_per_100g:      number
  fat_per_100g:        number
}

interface Props {
  onPicked:    (food: PickedFood) => void
  onCancel:    () => void
  confirmLabel?: string
}

const S = {
  lbl:   { fontSize: 9, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: 'var(--text-3)', fontWeight: 500, display: 'block' as const, marginBottom: 6 },
  input: { width: '100%', padding: '10px 12px', background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text)', fontSize: 13, fontFamily: 'DM Mono, monospace', outline: 'none' } as React.CSSProperties,
  svgBtn: (active: boolean): React.CSSProperties => ({
    width: '100%', padding: '10px 12px', fontSize: 13, border: '1px solid',
    borderColor: active ? 'var(--text)' : 'var(--border-2)',
    background: active ? 'var(--btn-bg)' : 'transparent',
    color: active ? 'var(--btn-fg)' : 'var(--text-2)',
    cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', textAlign: 'left',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 4,
  }),
}

export default function FoodPicker({ onPicked, onCancel, confirmLabel = 'Add food' }: Props) {
  const [view,         setView]         = useState<'search' | 'detail'>('search')
  const [query,        setQuery]        = useState('')
  const [results,      setResults]      = useState<FoodResult[]>([])
  const [suggestions,  setSuggestions]  = useState<string[]>([])
  const [searching,    setSearching]    = useState(false)
  const [selected,     setSelected]     = useState<FoodResult | null>(null)
  const [servings,     setServings]     = useState<ServingOption[]>([])
  const [serving,      setServing]      = useState<ServingOption | null>(null)
  const [servingQty,   setServingQty]   = useState('1')
  const [customQty,    setCustomQty]    = useState('100')
  const [loadingServs, setLoadingServs] = useState(false)
  const searchRef = useRef<ReturnType<typeof setTimeout>>()
  const acRef     = useRef<ReturnType<typeof setTimeout>>()
  const inputRef  = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (query.length < 2) { setResults([]); setSuggestions([]); setSearching(false); return }
    setSearching(true)
    clearTimeout(searchRef.current)
    searchRef.current = setTimeout(async () => {
      const res  = await fetch(`/api/food/search?q=${encodeURIComponent(query)}`, { credentials: 'include' })
      const data = await res.json()
      setResults(data.foods || [])
      setSearching(false)
    }, 300)
    clearTimeout(acRef.current)
    acRef.current = setTimeout(async () => {
      const res  = await fetch(`/api/food/autocomplete?q=${encodeURIComponent(query)}`, { credentials: 'include' })
      const data = await res.json()
      setSuggestions(data.suggestions || [])
    }, 150)
  }, [query])

  async function selectFood(food: FoodResult) {
    setSelected(food)
    setServings([])
    setServing(null)
    setCustomQty('100')
    setServingQty('1')
    setView('detail')

    if (food.servings_json) {
      try {
        const svgs: ServingOption[] = JSON.parse(food.servings_json as string)
        if (svgs.length > 0) {
          setServings(svgs)
          setServing(svgs.find(s => s.is_default) || svgs[0])
          return
        }
      } catch { /* fall through */ }
    }

    if (food.fs_food_id || (food as any).id) {
      setLoadingServs(true)
      const params = new URLSearchParams()
      if ((food as any).id) params.set('food_id', (food as any).id)
      if (food.fs_food_id)  params.set('fs_food_id', food.fs_food_id)
      const res  = await fetch(`/api/food/servings?${params}`, { credentials: 'include' })
      const data = await res.json()
      const svgs: ServingOption[] = data.servings || []
      setServings(svgs)
      setServing(svgs.find(s => s.is_default) || svgs[0] || null)
      setLoadingServs(false)
    }
  }

  function handleConfirm() {
    if (!selected) return
    const sq  = Math.max(0, parseFloat(servingQty) || 1)
    const cq  = parseFloat(customQty) || 100

    const foodMeta = {
      food_id:           (selected as any).id || undefined,
      food_name:         selected.name,
      food_brand:        selected.brand,
      calories_per_100g: selected.calories_per_100g,
      protein_per_100g:  selected.protein_per_100g,
      carbs_per_100g:    selected.carbs_per_100g,
      fat_per_100g:      selected.fat_per_100g,
    }

    let picked: PickedFood
    if (serving) {
      picked = {
        food:                selected,
        serving,
        servingQty:          sq,
        customQty:           0,
        quantity_g:          Math.round(serving.metric_g * sq),
        serving_description: sq === 1 ? serving.description : `${sq} × ${serving.description}`,
        calories_total:      Math.round(serving.calories * sq),
        protein_total:       Math.round(serving.protein  * sq * 10) / 10,
        carbs_total:         Math.round(serving.carbs    * sq * 10) / 10,
        fat_total:           Math.round(serving.fat      * sq * 10) / 10,
        ...foodMeta,
      }
    } else {
      const f = cq / 100
      picked = {
        food:                selected,
        serving:             null,
        servingQty:          1,
        customQty:           cq,
        quantity_g:          cq,
        serving_description: `${cq}g`,
        calories_total:      Math.round(selected.calories_per_100g * f),
        protein_total:       Math.round(selected.protein_per_100g  * f * 10) / 10,
        carbs_total:         Math.round(selected.carbs_per_100g    * f * 10) / 10,
        fat_total:           Math.round(selected.fat_per_100g      * f * 10) / 10,
        ...foodMeta,
      }
    }
    onPicked(picked)
  }

  const sq = Math.max(0, parseFloat(servingQty) || 1)
  const cq = parseFloat(customQty) || 0
  const activeNutrition = serving
    ? { calories: Math.round(serving.calories * sq), protein: Math.round(serving.protein * sq * 10) / 10, carbs: Math.round(serving.carbs * sq * 10) / 10, fat: Math.round(serving.fat * sq * 10) / 10 }
    : cq > 0 && selected
      ? { calories: Math.round(selected.calories_per_100g * cq / 100), protein: Math.round(selected.protein_per_100g * cq / 100 * 10) / 10, carbs: Math.round(selected.carbs_per_100g * cq / 100 * 10) / 10, fat: Math.round(selected.fat_per_100g * cq / 100 * 10) / 10 }
      : null

  const canConfirm = !!selected && (serving ? sq > 0 : cq > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {view === 'search' && (
        <>
          <input ref={inputRef} style={S.input} type="text" placeholder="Search foods..."
            value={query} onChange={e => setQuery(e.target.value)} autoFocus />

          {searching && <p style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center' }}>Searching...</p>}

          {suggestions.length > 0 && results.length === 0 && !searching && (
            <div style={{ border: '1px solid var(--border)' }}>
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => setQuery(s)}
                  style={{ width: '100%', textAlign: 'left', padding: '9px 12px', background: 'none', border: 'none', borderBottom: i < suggestions.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-2)', fontFamily: 'DM Sans, sans-serif' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {results.length > 0 && (
            <div style={{ border: '1px solid var(--border)' }}>
              {results.map((food, i) => (
                <button key={(food as any).id || i} onClick={() => selectFood(food)}
                  style={{ width: '100%', textAlign: 'left', padding: '11px 12px', background: 'none', border: 'none', borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <p style={{ fontSize: 13, color: 'var(--text)', margin: 0, fontWeight: 500 }}>{food.name}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0, fontFamily: 'DM Mono, monospace', flexShrink: 0 }}>{food.serving_calories ?? food.calories_per_100g} kcal</p>
                  </div>
                  <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '2px 0 0', fontFamily: 'DM Mono, monospace' }}>
                    {food.brand ? `${food.brand} · ` : ''}{food.serving_description ?? 'per 100g'} · {food.serving_protein ?? food.protein_per_100g}p {food.serving_carbs ?? food.carbs_per_100g}c {food.serving_fat ?? food.fat_per_100g}f
                  </p>
                </button>
              ))}
            </div>
          )}

          {!searching && query.length >= 2 && results.length === 0 && suggestions.length === 0 && (
            <p style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', padding: '8px 0' }}>No results found.</p>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button onClick={onCancel}
              style={{ flex: 1, padding: '10px', fontSize: 12, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border-2)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
              Cancel
            </button>
          </div>
        </>
      )}

      {view === 'detail' && selected && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <button onClick={() => { setView('search'); setSelected(null); setTimeout(() => inputRef.current?.focus(), 50) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', padding: '2px 4px', flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/></svg>
            </button>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{selected.name}</p>
          </div>
          {selected.brand && <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>{selected.brand}</p>}

          {loadingServs && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[1,2,3].map(i => <div key={i} style={{ height: 44, background: 'var(--surface-2)', border: '1px solid var(--border-2)' }} />)}
              <p style={{ fontSize: 10, color: 'var(--text-3)', textAlign: 'center' }}>Loading serving sizes...</p>
            </div>
          )}

          {!loadingServs && servings.length > 0 && (
            <div>
              <label style={S.lbl}>Choose serving</label>
              {servings.map(s => (
                <button key={s.serving_id} onClick={() => { setServing(s); setCustomQty(''); setServingQty('1') }}
                  style={S.svgBtn(serving?.serving_id === s.serving_id)}>
                  <span>{s.description}</span>
                  <span style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', flexShrink: 0, opacity: 0.8 }}>
                    {s.calories} kcal · {s.metric_g}g
                  </span>
                </button>
              ))}
              <button onClick={() => { setServing(null); setCustomQty('100'); setServingQty('1') }}
                style={S.svgBtn(!serving)}>
                <span>Custom amount (g)</span>
              </button>
            </div>
          )}

          {serving && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={S.lbl}>Quantity</label>
                <input style={S.input} type="number" min={0.25} max={20} step={0.25}
                  value={servingQty} onChange={e => setServingQty(e.target.value)} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 14 }}>× {serving.description}</div>
            </div>
          )}

          {!serving && (
            <div>
              <label style={S.lbl}>Quantity (g)</label>
              <input style={S.input} type="number" min={1} max={5000}
                value={customQty} onChange={e => setCustomQty(e.target.value)} placeholder="100" />
            </div>
          )}

          {activeNutrition && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, padding: '10px 12px', background: 'var(--surface-2)', border: '1px solid var(--border-2)' }}>
              {[
                { label: 'Calories', value: activeNutrition.calories },
                { label: 'Protein',  value: `${activeNutrition.protein}g` },
                { label: 'Carbs',    value: `${activeNutrition.carbs}g` },
                { label: 'Fat',      value: `${activeNutrition.fat}g` },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-3)', margin: '0 0 3px' }}>{s.label}</p>
                  <p style={{ fontSize: 14, fontFamily: 'DM Mono, monospace', fontWeight: 500, color: 'var(--text)', margin: 0 }}>{s.value}</p>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button onClick={() => { setView('search'); setSelected(null) }}
              style={{ flex: 1, padding: '10px', fontSize: 12, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border-2)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
              Back
            </button>
            <button onClick={handleConfirm} disabled={!canConfirm}
              style={{ flex: 2, padding: '10px', fontSize: 12, fontWeight: 600, background: 'var(--btn-bg)', color: 'var(--btn-fg)', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', opacity: !canConfirm ? 0.4 : 1 }}>
              {confirmLabel}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
