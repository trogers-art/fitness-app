'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'pre_workout' | 'post_workout'

interface FSRecipe {
  id: string
  name: string
  description: string
  image: string | null
  calories: number
  protein: number
  carbs: number
  fat: number
  ingredients: string[]
  types: string[]
}

interface TemplateItem {
  id: string
  quantity_g: number
  food: { id: string; name: string; calories_per_100g: number; protein_per_100g: number; carbs_per_100g: number; fat_per_100g: number }
}

interface Template {
  id: string
  name: string
  description: string | null
  meal_type: MealType | null
  created_at: string
  items: TemplateItem[]
}

const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: 'breakfast',    label: 'Breakfast' },
  { value: 'lunch',        label: 'Lunch' },
  { value: 'dinner',       label: 'Dinner' },
  { value: 'snack',        label: 'Snack' },
  { value: 'pre_workout',  label: 'Pre-workout' },
  { value: 'post_workout', label: 'Post-workout' },
]

const S = {
  lbl:   { fontSize: 9, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: 'var(--text-3)', fontWeight: 500 },
  card:  { background: 'var(--surface)', border: '1px solid var(--border)' } as React.CSSProperties,
  input: { width: '100%', padding: '10px 12px', background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text)', fontSize: 13, fontFamily: 'DM Mono, monospace', outline: 'none' } as React.CSSProperties,
}

// ── FatSecret Recipes tab ──────────────────────────────────────────────────

function FSRecipes() {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [query,    setQuery]    = useState('')
  const [recipes,  setRecipes]  = useState<FSRecipe[]>([])
  const [loading,  setLoading]  = useState(false)
  const [logging,  setLogging]  = useState<string | null>(null)
  const [logTarget, setLogTarget] = useState<{ recipe: FSRecipe; mealType: MealType } | null>(null)
  const searchRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    clearTimeout(searchRef.current)
    setLoading(true)
    searchRef.current = setTimeout(async () => {
      const res = await fetch(`/api/food/recipes?q=${encodeURIComponent(query)}`, { credentials: 'include' })
      const data = await res.json()
      setRecipes(data.recipes || [])
      setLoading(false)
    }, 400)
  }, [query])

  async function handleLogRecipe(recipe: FSRecipe, mealType: MealType) {
    setLogging(recipe.id)
    // Log recipe as a custom food entry (total macros)
    await fetch('/api/food/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        create_food: {
          name:              recipe.name,
          calories_per_100g: recipe.calories,
          protein_per_100g:  recipe.protein,
          carbs_per_100g:    recipe.carbs,
          fat_per_100g:      recipe.fat,
          source:            'custom',
        },
        meal_type: mealType,
        quantity_g: 100,
      }),
    })
    setLogging(null)
    setLogTarget(null)
    startTransition(() => router.refresh())
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input style={S.input} type="text" placeholder="Search recipes..." value={query}
        onChange={e => setQuery(e.target.value)} />

      {loading && <p style={{ ...S.lbl, textAlign: 'center', padding: '20px 0' }}>Searching...</p>}

      {recipes.map(recipe => (
        <div key={recipe.id} style={{ ...S.card, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 4px' }}>{recipe.name}</p>
                <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '0 0 10px', lineHeight: 1.5 }}>{recipe.description}</p>
                <div style={{ display: 'flex', gap: 14, fontSize: 10, fontFamily: 'DM Mono, monospace', color: 'var(--text-3)' }}>
                  <span><b style={{ color: 'var(--text-2)' }}>{recipe.calories}</b> kcal</span>
                  <span><b style={{ color: 'var(--blue)' }}>{recipe.protein}g</b> protein</span>
                  <span><b style={{ color: 'var(--amber)' }}>{recipe.carbs}g</b> carbs</span>
                  <span><b style={{ color: 'var(--red)' }}>{recipe.fat}g</b> fat</span>
                </div>
                {recipe.ingredients.length > 0 && (
                  <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '8px 0 0' }}>
                    {recipe.ingredients.slice(0, 5).join(', ')}{recipe.ingredients.length > 5 ? ` +${recipe.ingredients.length - 5} more` : ''}
                  </p>
                )}
              </div>
            </div>

            {/* Meal type picker */}
            {logTarget?.recipe.id === recipe.id ? (
              <div style={{ marginTop: 12 }}>
                <p style={{ ...S.lbl, marginBottom: 8 }}>Add to meal</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {MEAL_TYPES.map(m => (
                    <button key={m.value} onClick={() => handleLogRecipe(recipe, m.value)}
                      disabled={!!logging}
                      style={{ padding: '5px 10px', fontSize: 11, border: '1px solid var(--border-2)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                      {m.label}
                    </button>
                  ))}
                  <button onClick={() => setLogTarget(null)}
                    style={{ padding: '5px 10px', fontSize: 11, border: '1px solid var(--border-2)', background: 'transparent', color: 'var(--text-3)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setLogTarget({ recipe, mealType: 'snack' })}
                style={{ marginTop: 12, padding: '7px 14px', fontSize: 11, fontWeight: 600, background: 'var(--btn-bg)', color: 'var(--btn-fg)', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                Log recipe
              </button>
            )}
          </div>
        </div>
      ))}

      {!loading && recipes.length === 0 && (
        <p style={{ ...S.lbl, textAlign: 'center', padding: '32px 0' }}>Search for a recipe above</p>
      )}
    </div>
  )
}

// ── Meal Templates tab ─────────────────────────────────────────────────────

function MealTemplates() {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [templates,   setTemplates]   = useState<Template[]>([])
  const [creating,    setCreating]    = useState(false)
  const [logging,     setLogging]     = useState<string | null>(null)
  const [logTarget,   setLogTarget]   = useState<{ id: string } | null>(null)
  const [newTemplate, setNewTemplate] = useState({ name: '', description: '', meal_type: '' as MealType | '' })
  const [newItems,    setNewItems]    = useState<{ food_id: string; food_name: string; quantity_g: number }[]>([])
  const [foodQuery,   setFoodQuery]   = useState('')
  const [foodResults, setFoodResults] = useState<any[]>([])
  const searchRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    fetch('/api/food/meal-templates', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setTemplates(d.templates || []))
  }, [])

  useEffect(() => {
    if (foodQuery.length < 2) { setFoodResults([]); return }
    clearTimeout(searchRef.current)
    searchRef.current = setTimeout(async () => {
      const res = await fetch(`/api/food/search?q=${encodeURIComponent(foodQuery)}`, { credentials: 'include' })
      const data = await res.json()
      setFoodResults(data.foods || [])
    }, 300)
  }, [foodQuery])

  function calcTemplateTotals(items: TemplateItem[]) {
    return items.reduce((acc, item) => {
      const f = item.quantity_g / 100
      return {
        calories: acc.calories + Math.round(item.food.calories_per_100g * f),
        protein:  acc.protein  + Math.round(item.food.protein_per_100g  * f * 10) / 10,
        carbs:    acc.carbs    + Math.round(item.food.carbs_per_100g    * f * 10) / 10,
        fat:      acc.fat      + Math.round(item.food.fat_per_100g      * f * 10) / 10,
      }
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 })
  }

  async function handleSaveTemplate() {
    if (!newTemplate.name || newItems.length === 0) return
    await fetch('/api/food/meal-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name:      newTemplate.name,
        description: newTemplate.description || undefined,
        meal_type: newTemplate.meal_type || undefined,
        items:     newItems.map(i => ({ food_id: i.food_id, quantity_g: i.quantity_g })),
      }),
    })
    // Refresh templates
    const res = await fetch('/api/food/meal-templates', { credentials: 'include' })
    const data = await res.json()
    setTemplates(data.templates || [])
    setCreating(false)
    setNewTemplate({ name: '', description: '', meal_type: '' })
    setNewItems([])
  }

  async function handleLogTemplate(templateId: string, mealType: MealType) {
    setLogging(templateId)
    await fetch(`/api/food/meal-templates/${templateId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ meal_type: mealType }),
    })
    setLogging(null)
    setLogTarget(null)
    startTransition(() => router.refresh())
  }

  async function handleDelete(id: string) {
    await fetch(`/api/food/meal-templates/${id}`, { method: 'DELETE', credentials: 'include' })
    setTemplates(t => t.filter(x => x.id !== id))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ ...S.lbl, marginBottom: 0 }}>Your meal templates</p>
        <button onClick={() => setCreating(true)}
          style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, background: 'var(--btn-bg)', color: 'var(--btn-fg)', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
          + New template
        </button>
      </div>

      {/* Template list */}
      {templates.map(t => {
        const totals = calcTemplateTotals(t.items)
        return (
          <div key={t.id} style={S.card}>
            <div style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{t.name}</p>
                <button onClick={() => handleDelete(t.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 0 }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/>
                  </svg>
                </button>
              </div>

              {/* Items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 10 }}>
                {t.items.map(item => (
                  <p key={item.id} style={{ fontSize: 11, color: 'var(--text-3)', margin: 0, fontFamily: 'DM Mono, monospace' }}>
                    {item.food.name} <span style={{ color: 'var(--text-3)' }}>— {item.quantity_g}g</span>
                  </p>
                ))}
              </div>

              {/* Totals */}
              <div style={{ display: 'flex', gap: 14, fontSize: 10, fontFamily: 'DM Mono, monospace', color: 'var(--text-3)', marginBottom: 12 }}>
                <span><b style={{ color: 'var(--text-2)' }}>{totals.calories}</b> kcal</span>
                <span><b style={{ color: 'var(--blue)' }}>{totals.protein}g</b> protein</span>
                <span><b style={{ color: 'var(--amber)' }}>{totals.carbs}g</b> carbs</span>
                <span><b style={{ color: 'var(--red)' }}>{totals.fat}g</b> fat</span>
              </div>

              {/* Log */}
              {logTarget?.id === t.id ? (
                <div>
                  <p style={{ ...S.lbl, marginBottom: 8 }}>Add to meal</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {MEAL_TYPES.map(m => (
                      <button key={m.value} onClick={() => handleLogTemplate(t.id, m.value)}
                        disabled={!!logging}
                        style={{ padding: '5px 10px', fontSize: 11, border: '1px solid var(--border-2)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                        {m.label}
                      </button>
                    ))}
                    <button onClick={() => setLogTarget(null)}
                      style={{ padding: '5px 10px', fontSize: 11, border: '1px solid var(--border-2)', background: 'transparent', color: 'var(--text-3)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setLogTarget({ id: t.id })}
                  disabled={!!logging}
                  style={{ padding: '7px 14px', fontSize: 11, fontWeight: 600, background: 'var(--btn-bg)', color: 'var(--btn-fg)', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', opacity: logging === t.id ? 0.5 : 1 }}>
                  {logging === t.id ? 'Logging...' : 'Log meal'}
                </button>
              )}
            </div>
          </div>
        )
      })}

      {templates.length === 0 && !creating && (
        <p style={{ ...S.lbl, textAlign: 'center', padding: '32px 0' }}>No meal templates yet. Create one to log recurring meals in one tap.</p>
      )}

      {/* Create template form */}
      {creating && (
        <div style={{ ...S.card, padding: '16px' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: '0 0 16px' }}>New meal template</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ ...S.lbl, marginBottom: 6 }}>Template name</label>
              <input style={S.input} type="text" placeholder="e.g. Morning coffee & eggs"
                value={newTemplate.name} onChange={e => setNewTemplate(p => ({ ...p, name: e.target.value }))} />
            </div>

            <div>
              <label style={{ ...S.lbl, marginBottom: 6 }}>Default meal (optional)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {MEAL_TYPES.map(m => (
                  <button key={m.value} onClick={() => setNewTemplate(p => ({ ...p, meal_type: p.meal_type === m.value ? '' : m.value }))}
                    style={{ padding: '5px 10px', fontSize: 11, border: '1px solid', borderColor: newTemplate.meal_type === m.value ? 'var(--text)' : 'var(--border-2)', background: newTemplate.meal_type === m.value ? 'var(--btn-bg)' : 'transparent', color: newTemplate.meal_type === m.value ? 'var(--btn-fg)' : 'var(--text-2)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Food items */}
            <div>
              <label style={{ ...S.lbl, marginBottom: 6 }}>Foods</label>
              {newItems.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ flex: 1, fontSize: 12, color: 'var(--text)' }}>{item.food_name}</span>
                  <input type="number" min={1} value={item.quantity_g}
                    onChange={e => setNewItems(prev => prev.map((x, j) => j === i ? { ...x, quantity_g: parseFloat(e.target.value) } : x))}
                    style={{ ...S.input, width: 80, padding: '6px 8px' }} />
                  <span style={{ fontSize: 10, color: 'var(--text-3)' }}>g</span>
                  <button onClick={() => setNewItems(prev => prev.filter((_, j) => j !== i))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4 }}>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/>
                    </svg>
                  </button>
                </div>
              ))}

              {/* Food search */}
              <input style={{ ...S.input, marginTop: 6 }} type="text" placeholder="Search to add food..."
                value={foodQuery} onChange={e => setFoodQuery(e.target.value)} />
              {foodResults.length > 0 && (
                <div style={{ border: '1px solid var(--border)', marginTop: 4 }}>
                  {foodResults.slice(0, 6).map((food: any, i: number) => (
                    <button key={food.id || i}
                      onClick={() => {
                        setNewItems(prev => [...prev, { food_id: food.id, food_name: food.name, quantity_g: food.serving_size_g || 100 }])
                        setFoodQuery('')
                        setFoodResults([])
                      }}
                      style={{ width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', borderBottom: i < Math.min(foodResults.length, 6) - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                      <p style={{ fontSize: 12, color: 'var(--text)', margin: 0 }}>{food.name}</p>
                      <p style={{ fontSize: 10, color: 'var(--text-3)', margin: 0, fontFamily: 'DM Mono, monospace' }}>
                        {food.calories_per_100g} kcal/100g
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button onClick={() => { setCreating(false); setNewItems([]); setNewTemplate({ name: '', description: '', meal_type: '' }) }}
                style={{ flex: 1, padding: '10px', fontSize: 12, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border-2)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                Cancel
              </button>
              <button onClick={handleSaveTemplate} disabled={!newTemplate.name || newItems.length === 0}
                style={{ flex: 2, padding: '10px', fontSize: 12, fontWeight: 600, background: 'var(--btn-bg)', color: 'var(--btn-fg)', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', opacity: (!newTemplate.name || newItems.length === 0) ? 0.4 : 1 }}>
                Save template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main export ────────────────────────────────────────────────────────────

type RecipeTab = 'templates' | 'discover'

export default function Recipes() {
  const [tab, setTab] = useState<RecipeTab>('templates')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        {([['templates', 'My templates'], ['discover', 'Discover recipes']] as [RecipeTab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '10px 0', fontSize: 11, fontWeight: 500,
            background: 'none', border: 'none', cursor: 'pointer',
            borderBottom: tab === t ? '2px solid var(--text)' : '2px solid transparent',
            color: tab === t ? 'var(--text)' : 'var(--text-3)',
            fontFamily: 'DM Sans, sans-serif', transition: 'color 0.1s',
          }}>{label}</button>
        ))}
      </div>

      {tab === 'templates' ? <MealTemplates /> : <FSRecipes />}
    </div>
  )
}
