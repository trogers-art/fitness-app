'use client'

import { useState, useEffect, useRef } from 'react'

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
  serving_description?: string | null
  serving_calories?: number | null
  serving_protein?: number | null
  serving_carbs?: number | null
  serving_fat?: number | null
  servings_json?: string | null
  fs_food_id?: string | null
}

interface ServingOption {
  serving_id:  string
  description: string
  metric_g:    number
  calories:    number
  protein:     number
  carbs:       number
  fat:         number
  is_default:  boolean
}

interface Props {
  mealType: MealType
  mealLabel: string
  onClose: () => void
  onAdded: () => void
  loggedAt?: string   // YYYY-MM-DD, defaults to today
}

type View = 'search' | 'detail' | 'manual'

export default function AddFood({ mealType, mealLabel, onClose, onAdded, loggedAt }: Props) {
  const [view,        setView]        = useState<View>('search')
  const [query,       setQuery]       = useState('')
  const [results,     setResults]     = useState<FoodResult[]>([])
  const [searching,   setSearching]   = useState(false)
  const [selected,    setSelected]    = useState<FoodResult | null>(null)
  const [servings,    setServings]    = useState<ServingOption[]>([])
  const [serving,     setServing]     = useState<ServingOption | null>(null)
  const [customQty,   setCustomQty]   = useState('')
  const [loadingSvg,  setLoadingSvg]  = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [manual, setManual] = useState({ name: '', calories: '', protein: '', carbs: '', fat: '', qty: '100' })
  const searchRef = useRef<ReturnType<typeof setTimeout>>()
  const inputRef  = useRef<HTMLInputElement>(null)

  const updateManual = (f: string, v: string) => setManual(p => ({ ...p, [f]: v }))

  useEffect(() => {
    if (query.length < 2) { setResults([]); setSearching(false); return }
    setSearching(true)
    clearTimeout(searchRef.current)
    searchRef.current = setTimeout(async () => {
      const res = await fetch(`/api/food/search?q=${encodeURIComponent(query)}`, { credentials: 'include' })
      const data = await res.json()
      setResults(data.foods || [])
      setSearching(false)
    }, 300)
  }, [query])

  async function selectFood(food: FoodResult) {
    setSelected(food)
    setServings([])
    setServing(null)
    setCustomQty('')
    setView('detail')

    // Use embedded servings from search.v2 response first — no API call needed
    if (food.servings_json) {
      try {
        const svgs: ServingOption[] = JSON.parse(food.servings_json)
        if (svgs.length > 0) {
          setServings(svgs)
          const def = svgs.find(s => s.is_default) || svgs.find(s => s.metric_g !== 100) || svgs[0]
          setServing(def || null)
          return
        }
      } catch { /* fall through */ }
    }

    // Fallback: fetch from API — pass food_id so route can look up fs_food_id from DB
    if (food.fs_food_id || (food as any).id) {
      setLoadingSvg(true)
      const params = new URLSearchParams()
      if ((food as any).id) params.set('food_id', (food as any).id)
      if (food.fs_food_id) params.set('fs_food_id', food.fs_food_id)
      const res = await fetch(`/api/food/servings?${params.toString()}`, { credentials: 'include' })
      const data = await res.json()
      const svgs: ServingOption[] = data.servings || []
      setServings(svgs)
      const def = svgs.find(s => s.is_default) || svgs.find(s => s.metric_g !== 100) || svgs[0] || null
      setServing(def)
      setLoadingSvg(false)
    } else {
      setCustomQty(String(food.serving_size_g || 100))
    }
  }

  function goBack() {
    setView('search')
    setSelected(null)
    // Restore focus to search input, preserve query
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const qtyNum = parseFloat(customQty) || 0
  const customPreview = selected && qtyNum > 0 && !serving ? {
    calories: Math.round(selected.calories_per_100g * qtyNum / 100),
    protein:  Math.round(selected.protein_per_100g  * qtyNum / 100 * 10) / 10,
    carbs:    Math.round(selected.carbs_per_100g    * qtyNum / 100 * 10) / 10,
    fat:      Math.round(selected.fat_per_100g      * qtyNum / 100 * 10) / 10,
  } : null

  const activeNutrition = serving
    ? { calories: serving.calories, protein: serving.protein, carbs: serving.carbs, fat: serving.fat }
    : customPreview

  async function handleAdd() {
    setSaving(true)

    if (view === 'manual') {
      const qty = parseFloat(manual.qty)
      const f   = qty / 100
      await fetch('/api/food/entries', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          create_food: { name: manual.name, calories_per_100g: parseFloat(manual.calories), protein_per_100g: parseFloat(manual.protein || '0'), carbs_per_100g: parseFloat(manual.carbs || '0'), fat_per_100g: parseFloat(manual.fat || '0'), source: 'custom' },
          meal_type: mealType, quantity_g: qty,
          serving_description: `${qty}g`,
          calories_total: Math.round(parseFloat(manual.calories) * f),
          protein_total:  Math.round(parseFloat(manual.protein || '0') * f * 10) / 10,
          carbs_total:    Math.round(parseFloat(manual.carbs   || '0') * f * 10) / 10,
          fat_total:      Math.round(parseFloat(manual.fat     || '0') * f * 10) / 10,
        }),
      })
      onAdded(); return
    }

    if (!selected) { setSaving(false); return }

    const nutrition = serving
      ? { serving_description: serving.description, calories_total: serving.calories, protein_total: serving.protein, carbs_total: serving.carbs, fat_total: serving.fat, quantity_g: serving.metric_g }
      : { serving_description: `${qtyNum}g`, calories_total: customPreview?.calories, protein_total: customPreview?.protein, carbs_total: customPreview?.carbs, fat_total: customPreview?.fat, quantity_g: qtyNum }

    await fetch('/api/food/entries', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({
        food_id:           (selected as any).id || undefined,
        food_name:         selected.name,
        food_brand:        selected.brand,
        calories_per_100g: selected.calories_per_100g,
        protein_per_100g:  selected.protein_per_100g,
        carbs_per_100g:    selected.carbs_per_100g,
        fat_per_100g:      selected.fat_per_100g,
        meal_type:         mealType,
        logged_at:         loggedAt ? `${loggedAt}T12:00:00` : undefined,
        ...nutrition,
      }),
    })
    onAdded()
  }

  const canAdd = view === 'detail'
    ? !!selected && (!!serving || qtyNum > 0)
    : view === 'manual'
    ? !!manual.name && !!manual.calories && parseFloat(manual.qty) > 0
    : false

  // Styles
  const S = {
    overlay: {
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.6)',
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',      // ← centered, not bottom
      justifyContent: 'center',
      padding: '20px 0',
    } as React.CSSProperties,
    modal: {
      width: '100%', maxWidth: 560,
      margin: '0 16px',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      maxHeight: '82vh',
    } as React.CSSProperties,
    input: {
      width: '100%', padding: '10px 12px',
      background: 'var(--surface-2)',
      border: '1px solid var(--border-2)',
      color: 'var(--text)', fontSize: 13,
      fontFamily: 'DM Mono, monospace', outline: 'none',
    } as React.CSSProperties,
    lbl: {
      fontSize: 9, textTransform: 'uppercase' as const,
      letterSpacing: '0.12em', color: 'var(--text-3)',
      fontWeight: 500, display: 'block', marginBottom: 6,
    },
    svgBtn: (active: boolean): React.CSSProperties => ({
      width: '100%', padding: '10px 12px', fontSize: 13,
      border: '1px solid',
      borderColor: active ? 'var(--text)' : 'var(--border-2)',
      background: active ? 'var(--btn-bg)' : 'transparent',
      color: active ? 'var(--btn-fg)' : 'var(--text-2)',
      cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
      textAlign: 'left', transition: 'all 0.1s',
      display: 'flex', justifyContent: 'space-between',
      alignItems: 'center', gap: 12, marginBottom: 4,
    }),
  }

  return (
    <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={S.modal}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {view === 'detail' && (
            <button onClick={goBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', padding: '2px 4px', flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/>
              </svg>
            </button>
          )}
          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', margin: 0, flex: 1 }}>
            {view === 'detail' ? selected?.name : `Add to ${mealLabel}`}
          </p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4, flexShrink: 0 }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M1 1l11 11M12 1L1 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/>
            </svg>
          </button>
        </div>

        {/* Tab toggle — only on search view */}
        {view !== 'detail' && (
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            {(['search', 'manual'] as ('search' | 'manual')[]).map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                flex: 1, padding: '9px 0', fontSize: 11, fontWeight: 500,
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: view === v ? '2px solid var(--text)' : '2px solid transparent',
                color: view === v ? 'var(--text)' : 'var(--text-3)',
                textTransform: 'capitalize', fontFamily: 'DM Sans, sans-serif',
              }}>
                {v === 'search' ? 'Search' : 'Manual entry'}
              </button>
            ))}
          </div>
        )}

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* ── Search view ── */}
          {view === 'search' && (
            <>
              <input ref={inputRef} style={S.input} type="text" placeholder="Search foods..."
                value={query} onChange={e => setQuery(e.target.value)} autoFocus />

              {searching && (
                <p style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', padding: '8px 0' }}>Searching...</p>
              )}

              {results.length > 0 && (
                <div style={{ border: '1px solid var(--border)' }}>
                  {results.map((food, i) => {
                    // Show serving label from parsed description — "1 mug (8 fl oz) · 2 kcal"
                    const hasServing = food.serving_description && food.serving_calories != null
                    const servingLabel = hasServing
                      ? `${food.serving_description} · ${food.serving_calories} kcal`
                      : `per 100g · ${food.calories_per_100g} kcal`
                    const macroLabel = hasServing
                      ? `${food.serving_protein}p ${food.serving_carbs}c ${food.serving_fat}f`
                      : `${food.protein_per_100g}p ${food.carbs_per_100g}c ${food.fat_per_100g}f`

                    return (
                      <button key={food.id || i} onClick={() => selectFood(food)}
                        style={{
                          width: '100%', textAlign: 'left', padding: '11px 12px',
                          background: 'none', border: 'none',
                          borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none',
                          cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                          <p style={{ fontSize: 13, color: 'var(--text)', margin: 0, fontWeight: 500 }}>
                            {food.name}
                          </p>
                          <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0, fontFamily: 'DM Mono, monospace', flexShrink: 0 }}>
                            {food.calories_per_100g} kcal
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                          {food.brand && (
                            <p style={{ fontSize: 10, color: 'var(--text-3)', margin: 0 }}>{food.brand}</p>
                          )}
                          <p style={{ fontSize: 10, color: 'var(--text-3)', margin: 0, fontFamily: 'DM Mono, monospace' }}>
                            {servingLabel} · {macroLabel}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              {!searching && query.length >= 2 && results.length === 0 && (
                <p style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', padding: '16px 0' }}>
                  No results. Try manual entry.
                </p>
              )}
            </>
          )}

          {/* ── Detail view ── */}
          {view === 'detail' && selected && (
            <>
              {/* Food info */}
              {selected.brand && (
                <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>{selected.brand}</p>
              )}

              {loadingSvg && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[1,2,3].map(i => (
                    <div key={i} style={{ height: 44, background: 'var(--surface-2)', border: '1px solid var(--border-2)', animation: 'pulse 1.5s infinite' }} />
                  ))}
                  <p style={{ fontSize: 10, color: 'var(--text-3)', textAlign: 'center' }}>Loading serving sizes...</p>
                </div>
              )}

              {!loadingSvg && servings.length === 0 && selected?.fs_food_id && (
                <div style={{ padding: '12px 14px', border: '1px solid var(--border-2)', background: 'var(--surface-2)' }}>
                  <p style={{ fontSize: 11, color: 'var(--text-2)', margin: '0 0 8px' }}>Could not load serving sizes. Enter quantity manually:</p>
                </div>
              )}

              {/* Serving options */}
              {servings.length > 0 && !loadingSvg && (
                <div>
                  <label style={S.lbl}>Choose serving</label>
                  {servings.map(s => (
                    <button key={s.serving_id} onClick={() => { setServing(s); setCustomQty('') }}
                      style={S.svgBtn(serving?.serving_id === s.serving_id)}>
                      <span>{s.description}</span>
                      <span style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', flexShrink: 0, opacity: 0.8 }}>
                        {s.calories} kcal · {s.metric_g}g
                      </span>
                    </button>
                  ))}
                  {/* Custom gram option */}
                  <button onClick={() => { setServing(null); setCustomQty('100') }}
                    style={S.svgBtn(!serving)}>
                    <span>Custom amount (g)</span>
                  </button>
                </div>
              )}

              {/* Custom gram input */}
              {(!serving) && (
                <div>
                  <label style={S.lbl}>Quantity (g)</label>
                  <input style={S.input} type="number" min={1} max={5000}
                    value={customQty} onChange={e => setCustomQty(e.target.value)}
                    placeholder="100" autoFocus={servings.length > 0} />
                </div>
              )}

              {/* Nutrition preview */}
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
                  { field: 'calories', label: 'Calories (per 100g)', ph: '165' },
                  { field: 'protein',  label: 'Protein g (per 100g)', ph: '31' },
                  { field: 'carbs',    label: 'Carbs g (per 100g)',   ph: '0' },
                  { field: 'fat',      label: 'Fat g (per 100g)',     ph: '3.6' },
                ].map(f => (
                  <div key={f.field}>
                    <label style={S.lbl}>{f.label}</label>
                    <input style={S.input} type="number" min={0} placeholder={f.ph}
                      value={manual[f.field as keyof typeof manual]} onChange={e => updateManual(f.field, e.target.value)} />
                  </div>
                ))}
              </div>
              <div>
                <label style={S.lbl}>Quantity (g)</label>
                <input style={S.input} type="number" min={1} value={manual.qty}
                  onChange={e => updateManual('qty', e.target.value)} />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px 0', fontSize: 13, fontWeight: 500, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border-2)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
            Cancel
          </button>
          {view === 'detail' || view === 'manual' ? (
            <button onClick={handleAdd} disabled={saving || !canAdd}
              style={{ flex: 2, padding: '11px 0', fontSize: 13, fontWeight: 600, background: 'var(--btn-bg)', color: 'var(--btn-fg)', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', opacity: (saving || !canAdd) ? 0.4 : 1 }}>
              {saving ? 'Adding...' : 'Add to diary'}
            </button>
          ) : (
            <div style={{ flex: 2 }} />
          )}
        </div>
      </div>
    </div>
  )
}
