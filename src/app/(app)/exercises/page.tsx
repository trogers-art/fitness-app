'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface Exercise {
  id: string
  name: string
  muscle_group: string
  secondary_muscles: string[]
  equipment: string[]
  type: string
  instructions: string[]
  gif_url: string | null
}

const MUSCLES = ['all','chest','back','shoulders','biceps','triceps','forearms','core','quads','hamstrings','glutes','calves','full_body','cardio']
const TYPES   = ['all','compound','isolation','cardio','mobility']

const S = {
  lbl:   { fontSize: 9, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: 'var(--text-3)', fontWeight: 500 },
  card:  { background: 'var(--surface)', border: '1px solid var(--border)' } as React.CSSProperties,
  input: { width: '100%', padding: '10px 12px', background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text)', fontSize: 13, fontFamily: 'DM Mono, monospace', outline: 'none' } as React.CSSProperties,
  chip:  (active: boolean): React.CSSProperties => ({
    padding: '4px 10px', fontSize: 11, border: '1px solid',
    borderColor: active ? 'var(--text)' : 'var(--border-2)',
    background: active ? 'var(--btn-bg)' : 'transparent',
    color: active ? 'var(--btn-fg)' : 'var(--text-2)',
    cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
    whiteSpace: 'nowrap' as const,
  }),
}

function ExerciseDetail({ ex, onClose }: { ex: Exercise; onClose: () => void }) {
  const [gif, setGif] = useState<string | null>(ex.gif_url)
  const [loadingGif, setLoadingGif] = useState(!ex.gif_url)

  useEffect(() => {
    if (ex.gif_url) return
    setLoadingGif(true)
    fetch(`/api/exercises/gif?exercise_id=${ex.id}&name=${encodeURIComponent(ex.name)}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setGif(d.gif_url); setLoadingGif(false) })
      .catch(() => setLoadingGif(false))
  }, [ex.id, ex.name, ex.gif_url])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ width: '100%', maxWidth: 480, background: 'var(--surface)', border: '1px solid var(--border)', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{ex.name}</p>
            <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '2px 0 0', textTransform: 'capitalize' }}>{ex.muscle_group.replace('_',' ')} · {ex.type}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/></svg>
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* GIF */}
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {loadingGif ? (
              <p style={{ fontSize: 11, color: 'var(--text-3)' }}>Loading animation...</p>
            ) : gif ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={gif} alt={ex.name} style={{ maxHeight: 220, maxWidth: '100%', objectFit: 'contain' }} />
            ) : (
              <p style={{ fontSize: 11, color: 'var(--text-3)' }}>No animation available</p>
            )}
          </div>

          {/* Tags */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {ex.equipment.map(e => (
              <span key={e} style={{ padding: '3px 8px', fontSize: 10, border: '1px solid var(--border-2)', color: 'var(--text-2)', textTransform: 'capitalize' }}>{e}</span>
            ))}
            {ex.secondary_muscles?.map(m => (
              <span key={m} style={{ padding: '3px 8px', fontSize: 10, border: '1px solid var(--border-2)', color: 'var(--text-3)', textTransform: 'capitalize' }}>{m}</span>
            ))}
          </div>

          {/* Instructions */}
          {ex.instructions?.length > 0 && (
            <div>
              <p style={{ ...S.lbl, marginBottom: 10 }}>Instructions</p>
              <ol style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ex.instructions.map((step, i) => (
                  <li key={i} style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>{step}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ExercisesPage() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading,   setLoading]   = useState(true)
  const [query,     setQuery]     = useState('')
  const [muscle,    setMuscle]    = useState('all')
  const [type,      setType]      = useState('all')
  const [selected,  setSelected]  = useState<Exercise | null>(null)
  const searchRef = useRef<ReturnType<typeof setTimeout>>()

  const fetch_ = useCallback(async (q: string, m: string, t: string) => {
    setLoading(true)
    const params = new URLSearchParams({ q, muscle: m, type: t, limit: '60' })
    const res = await fetch(`/api/exercises?${params}`, { credentials: 'include' })
    const data = await res.json()
    setExercises(data.exercises || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    clearTimeout(searchRef.current)
    searchRef.current = setTimeout(() => fetch_(query, muscle, type), 300)
  }, [query, muscle, type, fetch_])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <p style={{ ...S.lbl, marginBottom: 4 }}>Library</p>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--page-title)', margin: 0 }}>Exercises</h1>
      </div>

      {/* Search */}
      <input style={S.input} type="text" placeholder="Search exercises..."
        value={query} onChange={e => setQuery(e.target.value)} />

      {/* Muscle filter */}
      <div style={{ overflowX: 'auto', display: 'flex', gap: 6, paddingBottom: 4 }}>
        {MUSCLES.map(m => (
          <button key={m} style={S.chip(muscle === m)} onClick={() => setMuscle(m)}>
            {m === 'all' ? 'All muscles' : m.replace('_',' ')}
          </button>
        ))}
      </div>

      {/* Type filter */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TYPES.map(t => (
          <button key={t} style={S.chip(type === t)} onClick={() => setType(t)}>
            {t === 'all' ? 'All types' : t}
          </button>
        ))}
      </div>

      {/* Count */}
      <p style={{ ...S.lbl, marginBottom: 0 }}>{loading ? 'Loading...' : `${exercises.length} exercises`}</p>

      {/* Exercise grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {exercises.map(ex => (
          <button key={ex.id} onClick={() => setSelected(ex)}
            style={{ ...S.card, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', border: 'none', cursor: 'pointer', width: '100%', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.name}</p>
              <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '2px 0 0', textTransform: 'capitalize' }}>
                {ex.muscle_group.replace('_',' ')} · {ex.equipment?.slice(0,2).join(', ')}
              </p>
            </div>
            <span style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'capitalize', flexShrink: 0 }}>{ex.type}</span>
            {ex.gif_url && <span style={{ width: 6, height: 6, background: 'var(--green)', borderRadius: '50%', flexShrink: 0 }} title="Has animation" />}
          </button>
        ))}
      </div>

      {selected && <ExerciseDetail ex={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
