'use client'

import { useState, useEffect } from 'react'

const S_lbl = { fontSize: 9, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: 'var(--text-3)', fontWeight: 500 }

export interface ExerciseDetailProps {
  exercise: { id: string; name: string; muscle_group: string; gif_url: string | null }
  sets?: number
  reps?: string
  rest?: number
  onClose: () => void
}

export function ExerciseDetailModal({ exercise, sets, reps, rest, onClose }: ExerciseDetailProps) {
  const [gifSrc,     setGifSrc]     = useState<string | null>(null)
  const [gifLoading, setGifLoading] = useState(true)

  useEffect(() => {
    async function resolveGif() {
      // Already have edb_id cached in DB — use it directly
      if (exercise.gif_url) {
        const match = exercise.gif_url.match(/^edb:(.+)$/)
        if (match) {
          setGifSrc(`/api/exercises/gif-image?edb_id=${match[1]}`)
          return
        }
      }

      // gif_url is null — hit the lookup route, cache edb_id in DB, then load GIF
      try {
        const res = await fetch(
          `/api/exercises/gif?exercise_id=${exercise.id}&name=${encodeURIComponent(exercise.name)}`,
          { credentials: 'include' }
        )
        const data = await res.json()
        if (data.edb_id) {
          setGifSrc(`/api/exercises/gif-image?edb_id=${data.edb_id}`)
          return
        }
      } catch {
        // fall through to no-preview state
      }

      setGifLoading(false)
    }

    resolveGif()
  }, [exercise.id, exercise.gif_url, exercise.name])

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ width: '100%', maxWidth: 420, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', maxHeight: '88vh', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: '0 0 2px' }}>{exercise.name}</p>
            <p style={{ fontSize: 10, color: 'var(--text-3)', margin: 0, textTransform: 'capitalize' }}>
              {exercise.muscle_group.replace(/_/g, ' ')}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4, flexShrink: 0 }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1 1l11 11M12 1L1 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/></svg>
          </button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {/* GIF */}
          <div style={{ background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200, position: 'relative' }}>
            {gifLoading && (
              <p style={{ ...S_lbl, position: 'absolute' }}>Loading...</p>
            )}
            {gifSrc ? (
              <img
                src={gifSrc}
                alt={exercise.name}
                onLoad={() => setGifLoading(false)}
                onError={() => { setGifLoading(false); setGifSrc(null) }}
                style={{ maxWidth: '100%', maxHeight: 280, display: gifLoading ? 'none' : 'block', objectFit: 'contain' }}
              />
            ) : !gifLoading ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <p style={{ ...S_lbl }}>No preview available</p>
              </div>
            ) : null}
          </div>

          {/* Sets / reps / rest */}
          {(sets || reps || rest) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderBottom: '1px solid var(--border)' }}>
              {sets && (
                <div style={{ padding: '12px 16px', borderRight: '1px solid var(--border)' }}>
                  <p style={{ ...S_lbl, marginBottom: 4 }}>Sets</p>
                  <p style={{ fontSize: 18, fontFamily: 'DM Mono, monospace', fontWeight: 600, color: 'var(--text)', margin: 0 }}>{sets}</p>
                </div>
              )}
              {reps && (
                <div style={{ padding: '12px 16px', borderRight: '1px solid var(--border)' }}>
                  <p style={{ ...S_lbl, marginBottom: 4 }}>Reps</p>
                  <p style={{ fontSize: 18, fontFamily: 'DM Mono, monospace', fontWeight: 600, color: 'var(--text)', margin: 0 }}>{reps}</p>
                </div>
              )}
              {rest && (
                <div style={{ padding: '12px 16px' }}>
                  <p style={{ ...S_lbl, marginBottom: 4 }}>Rest</p>
                  <p style={{ fontSize: 18, fontFamily: 'DM Mono, monospace', fontWeight: 600, color: 'var(--text)', margin: 0 }}>{rest}s</p>
                </div>
              )}
            </div>
          )}

          {/* Instructions */}
          <div style={{ padding: '14px 16px' }}>
            <p style={{ ...S_lbl, marginBottom: 10 }}>How to perform</p>
            <ExerciseInstructions exerciseId={exercise.id} name={exercise.name} />
          </div>
        </div>
      </div>
    </div>
  )
}

function ExerciseInstructions({ exerciseId, name }: { exerciseId: string; name: string }) {
  const [instructions, setInstructions] = useState<string[] | null>(null)
  const [loading,      setLoading]      = useState(true)

  useEffect(() => {
    fetch(`/api/exercises?q=${encodeURIComponent(name)}&limit=1`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        const ex = data.exercises?.[0]
        setInstructions(ex?.instructions || null)
      })
      .catch(() => setInstructions(null))
      .finally(() => setLoading(false))
  }, [exerciseId])

  if (loading) return <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>Loading...</p>
  if (!instructions || instructions.length === 0) {
    return <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>No instructions available for {name}.</p>
  }

  return (
    <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {instructions.map((step, i) => (
        <li key={i} style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>{step}</li>
      ))}
    </ol>
  )
}
