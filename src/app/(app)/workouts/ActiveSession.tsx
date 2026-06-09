'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ExerciseDetailModal } from './page'

interface SessionExercise {
  id: string
  order_index: number
  target_sets: number
  target_reps: string
  rest_seconds: number
  exercise: { id: string; name: string; muscle_group: string; gif_url: string | null }
}

interface LoggedSet {
  exercise_id:   string
  exercise_name: string
  set_number:    number
  weight_kg?:    number
  reps?:         number
  completed:     boolean
}

interface Props {
  programId:   string
  sessionId:   string
  sessionName: string
  exercises:   SessionExercise[]
  onFinished:  () => void
  onCancel:    () => void
}

const S = {
  lbl: { fontSize: 9, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: 'var(--text-3)', fontWeight: 500 },
}

function RestTimer({ seconds, onDone }: { seconds: number; onDone: () => void }) {
  const [remaining, setRemaining] = useState(seconds)
  const [editMode,  setEditMode]  = useState(false)
  const [editVal,   setEditVal]   = useState(String(seconds))

  useEffect(() => {
    if (remaining <= 0) { onDone(); return }
    const t = setTimeout(() => setRemaining(r => r - 1), 1000)
    return () => clearTimeout(t)
  }, [remaining, onDone])

  const pct = Math.round(((seconds - remaining) / seconds) * 100)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: 32, textAlign: 'center', width: 240 }}>
        <p style={{ ...S.lbl, marginBottom: 16 }}>Rest</p>

        {editMode ? (
          <div style={{ marginBottom: 16 }}>
            <input type="number" value={editVal} onChange={e => setEditVal(e.target.value)}
              style={{ width: 80, padding: '8px', textAlign: 'center', background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text)', fontSize: 28, fontFamily: 'DM Mono, monospace' }} />
            <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>seconds</p>
            <button onClick={() => { setRemaining(parseInt(editVal) || seconds); setEditMode(false) }}
              style={{ marginTop: 8, padding: '6px 14px', background: 'var(--btn-bg)', color: 'var(--btn-fg)', border: 'none', cursor: 'pointer', fontSize: 12, fontFamily: 'DM Sans, sans-serif' }}>
              Set
            </button>
          </div>
        ) : (
          <button onClick={() => { setEditMode(true); setEditVal(String(remaining)) }}
            style={{ display: 'block', margin: '0 auto 16px', background: 'none', border: 'none', cursor: 'pointer' }}>
            <span style={{ fontSize: 64, fontFamily: 'DM Mono, monospace', fontWeight: 500, color: remaining <= 5 ? 'var(--red)' : 'var(--text)' }}>
              {remaining}
            </span>
          </button>
        )}

        <div style={{ height: 3, background: 'var(--border-2)', marginBottom: 20 }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--btn-bg)', transition: 'width 1s linear' }} />
        </div>

        <button onClick={onDone}
          style={{ width: '100%', padding: '10px', background: 'var(--btn-bg)', color: 'var(--btn-fg)', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'DM Sans, sans-serif' }}>
          Skip rest
        </button>
      </div>
    </div>
  )
}

export default function ActiveSession({ programId, sessionId, sessionName, exercises, onFinished, onCancel }: Props) {
  const sorted = [...exercises].sort((a,b) => a.order_index - b.order_index)

  const [loggedSets,   setLoggedSets]   = useState<Map<string, LoggedSet[]>>(() => {
    const m = new Map<string, LoggedSet[]>()
    for (const ex of sorted) m.set(ex.exercise.id, [])
    return m
  })
  const [currentExIdx, setCurrentExIdx] = useState(0)
  const [showTimer,    setShowTimer]    = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [detailEx,     setDetailEx]     = useState<SessionExercise | null>(null)
  const startedAt = useRef(new Date().toISOString())

  const currentEx = sorted[currentExIdx]

  const [inputs, setInputs] = useState<Record<string, { weight: string; reps: string }>>(() => {
    const m: Record<string, { weight: string; reps: string }> = {}
    for (const ex of sorted) m[ex.exercise.id] = { weight: '', reps: ex.target_reps.split('-')[0] || '10' }
    return m
  })

  function getSets(exId: string) { return loggedSets.get(exId) || [] }
  function completedSets(exId: string) { return getSets(exId).filter(s => s.completed).length }

  function logSet(ex: SessionExercise) {
    const inp  = inputs[ex.exercise.id]
    const sets = getSets(ex.exercise.id)
    const newSet: LoggedSet = {
      exercise_id:   ex.exercise.id,
      exercise_name: ex.exercise.name,
      set_number:    sets.length + 1,
      weight_kg:     inp.weight ? parseFloat(inp.weight) / 2.20462 : undefined,
      reps:          inp.reps ? parseInt(inp.reps) : undefined,
      completed:     true,
    }
    setLoggedSets(prev => {
      const next = new Map(prev)
      next.set(ex.exercise.id, [...(prev.get(ex.exercise.id) || []), newSet])
      return next
    })
    const isLastSet = sets.length + 1 >= ex.target_sets
    const isLastEx  = currentExIdx >= sorted.length - 1
    if (!isLastSet || !isLastEx) setShowTimer(true)
  }

  function removeLastSet(exId: string) {
    setLoggedSets(prev => {
      const next = new Map(prev)
      const sets = [...(prev.get(exId) || [])]
      sets.pop()
      next.set(exId, sets)
      return next
    })
  }

  const allSets         = Array.from(loggedSets.values()).flat()
  const totalSetsLogged = allSets.filter(s => s.completed).length

  async function handleFinish() {
    setSaving(true)
    const finishedAt = new Date().toISOString()
    const duration   = Math.round((new Date(finishedAt).getTime() - new Date(startedAt.current).getTime()) / 1000)

    await fetch('/api/workouts/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        program_id:       programId,
        session_id:       sessionId,
        name:             sessionName,
        started_at:       startedAt.current,
        finished_at:      finishedAt,
        duration_seconds: duration,
        sets:             allSets,
      }),
    })
    onFinished()
  }

  const timerSecs = currentEx?.rest_seconds || 60

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 80 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ ...S.lbl, marginBottom: 2 }}>{sessionName}</p>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>{totalSetsLogged} sets logged</p>
        </div>
        <button onClick={onCancel}
          style={{ background: 'none', border: '1px solid var(--border-2)', padding: '6px 12px', fontSize: 11, color: 'var(--text-3)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
          Cancel
        </button>
      </div>

      {/* Exercise tabs */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
        {sorted.map((ex, i) => {
          const done    = completedSets(ex.exercise.id)
          const total   = ex.target_sets
          const isActive = i === currentExIdx
          return (
            <button key={ex.id} onClick={() => setCurrentExIdx(i)}
              style={{
                padding: '5px 10px', fontSize: 11, fontWeight: 500, flexShrink: 0,
                border: '1px solid',
                borderColor: isActive ? 'var(--text)' : done >= total ? 'var(--green)' : 'var(--border-2)',
                background: isActive ? 'var(--btn-bg)' : 'transparent',
                color: isActive ? 'var(--btn-fg)' : done >= total ? 'var(--green)' : 'var(--text-2)',
                cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap',
              }}>
              {done >= total ? '✓ ' : ''}{ex.exercise.name.split(' ').slice(0,2).join(' ')}
            </button>
          )
        })}
      </div>

      {/* Current exercise */}
      {currentEx && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: '0 0 2px' }}>{currentEx.exercise.name}</p>
              <p style={{ fontSize: 10, color: 'var(--text-3)', margin: 0, textTransform: 'capitalize' }}>
                {currentEx.exercise.muscle_group.replace('_',' ')} · Target: {currentEx.target_sets} × {currentEx.target_reps}
              </p>
            </div>
            {/* Info button — opens exercise detail modal */}
            <button
              onClick={() => setDetailEx(currentEx)}
              title="How to perform"
              style={{ background: 'none', border: '1px solid var(--border-2)', padding: '4px 8px', cursor: 'pointer', color: 'var(--text-3)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}
              onMouseEnter={e => { e.currentTarget.style.borderColor='var(--text)'; e.currentTarget.style.color='var(--text)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border-2)'; e.currentTarget.style.color='var(--text-3)' }}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M6.5 5.5v4M6.5 4h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square"/>
              </svg>
              <span style={{ fontSize: 10, fontFamily: 'DM Sans, sans-serif' }}>How to</span>
            </button>
          </div>

          {/* Logged sets */}
          {getSets(currentEx.exercise.id).length > 0 && (
            <div style={{ borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr 32px', gap: 0, padding: '6px 16px' }}>
                <span style={S.lbl}>Set</span>
                <span style={S.lbl}>Weight</span>
                <span style={S.lbl}>Reps</span>
                <span />
              </div>
              {getSets(currentEx.exercise.id).map((set, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr 32px', gap: 0, padding: '7px 16px', borderTop: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 12, fontFamily: 'DM Mono, monospace', color: 'var(--text-3)' }}>{set.set_number}</span>
                  <span style={{ fontSize: 13, fontFamily: 'DM Mono, monospace', color: 'var(--text)' }}>
                    {set.weight_kg ? `${Math.round(set.weight_kg * 2.20462 * 10) / 10} lbs` : '—'}
                  </span>
                  <span style={{ fontSize: 13, fontFamily: 'DM Mono, monospace', color: 'var(--text)' }}>
                    {set.reps ?? '—'}
                  </span>
                  {i === getSets(currentEx.exercise.id).length - 1 && (
                    <button onClick={() => removeLastSet(currentEx.exercise.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 0 }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/></svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Log set form */}
          {completedSets(currentEx.exercise.id) < currentEx.target_sets && (
            <div style={{ padding: '14px 16px' }}>
              <p style={{ ...S.lbl, marginBottom: 10 }}>Set {completedSets(currentEx.exercise.id) + 1} of {currentEx.target_sets}</p>
              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ ...S.lbl, marginBottom: 5 }}>Weight (lbs)</p>
                  <input type="number" min={0} step={2.5}
                    value={inputs[currentEx.exercise.id]?.weight}
                    onChange={e => setInputs(prev => ({ ...prev, [currentEx.exercise.id]: { ...prev[currentEx.exercise.id], weight: e.target.value } }))}
                    placeholder="0"
                    style={{ width: '100%', padding: '10px 12px', background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text)', fontSize: 14, fontFamily: 'DM Mono, monospace', outline: 'none' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ ...S.lbl, marginBottom: 5 }}>Reps</p>
                  <input type="number" min={0}
                    value={inputs[currentEx.exercise.id]?.reps}
                    onChange={e => setInputs(prev => ({ ...prev, [currentEx.exercise.id]: { ...prev[currentEx.exercise.id], reps: e.target.value } }))}
                    placeholder={currentEx.target_reps.split('-')[0]}
                    style={{ width: '100%', padding: '10px 12px', background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text)', fontSize: 14, fontFamily: 'DM Mono, monospace', outline: 'none' }} />
                </div>
              </div>
              <button onClick={() => logSet(currentEx)}
                style={{ width: '100%', padding: '11px', background: 'var(--btn-bg)', color: 'var(--btn-fg)', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                Log set
              </button>
            </div>
          )}

          {/* Move to next exercise */}
          {completedSets(currentEx.exercise.id) >= currentEx.target_sets && currentExIdx < sorted.length - 1 && (
            <div style={{ padding: '14px 16px' }}>
              <button onClick={() => setCurrentExIdx(i => i + 1)}
                style={{ width: '100%', padding: '11px', background: 'var(--btn-bg)', color: 'var(--btn-fg)', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                Next exercise →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Finish button */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 20px', background: 'var(--surface)', borderTop: '1px solid var(--border)', zIndex: 50 }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <button onClick={handleFinish} disabled={saving || totalSetsLogged === 0}
            style={{ width: '100%', padding: '12px', background: 'var(--btn-bg)', color: 'var(--btn-fg)', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', opacity: (saving || totalSetsLogged === 0) ? 0.4 : 1 }}>
            {saving ? 'Saving...' : `Finish session · ${totalSetsLogged} sets`}
          </button>
        </div>
      </div>

      {showTimer && (
        <RestTimer seconds={timerSecs} onDone={() => setShowTimer(false)} />
      )}

      {/* Exercise detail modal */}
      {detailEx && (
        <ExerciseDetailModal
          exercise={detailEx.exercise}
          sets={detailEx.target_sets}
          reps={detailEx.target_reps}
          rest={detailEx.rest_seconds}
          onClose={() => setDetailEx(null)}
        />
      )}
    </div>
  )
}
