'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface Exercise {
  id: string; name: string; muscle_group: string
  equipment: string[]; type: string; gif_url: string | null
}

interface SessionExercise {
  exercise_id: string; exercise_name: string; muscle_group: string
  order_index: number; target_sets: number; target_reps: string
  rest_seconds: number
}

interface Session {
  day_of_week: number; focus: string
  exercises: SessionExercise[]
}

interface Program {
  id: string; name: string; goal: string
  duration_weeks: number; days_per_week: number
  active: boolean; ai_generated: boolean; created_at: string
  program_weeks: {
    id: string; week_number: number
    sessions: {
      id: string; day_of_week: number; focus: string
      session_exercises: {
        id: string; order_index: number; target_sets: number
        target_reps: string; rest_seconds: number
        exercise: { id: string; name: string; muscle_group: string; gif_url: string | null }
      }[]
    }[]
  }[]
}

const DAYS_SHORT = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const GOALS = [
  { value: 'fat_loss',    label: 'Fat loss' },
  { value: 'muscle_gain', label: 'Muscle gain' },
  { value: 'maintain',    label: 'Maintain' },
]
const MUSCLES = ['all','chest','back','shoulders','biceps','triceps','forearms','core','quads','hamstrings','glutes','calves','full_body','cardio']

const S = {
  lbl:   { fontSize: 9, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: 'var(--text-3)', fontWeight: 500 },
  card:  { background: 'var(--surface)', border: '1px solid var(--border)', padding: '16px 18px' } as React.CSSProperties,
  input: { width: '100%', padding: '10px 12px', background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text)', fontSize: 13, fontFamily: 'DM Mono, monospace', outline: 'none' } as React.CSSProperties,
  chip:  (active: boolean): React.CSSProperties => ({
    padding: '4px 10px', fontSize: 11, border: '1px solid',
    borderColor: active ? 'var(--text)' : 'var(--border-2)',
    background: active ? 'var(--btn-bg)' : 'transparent',
    color: active ? 'var(--btn-fg)' : 'var(--text-2)',
    cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap' as const,
  }),
}

// ── Exercise Picker Modal ──────────────────────────────────────────────────

function ExercisePicker({ onAdd, onClose }: { onAdd: (ex: Exercise) => void; onClose: () => void }) {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [query,  setQuery]  = useState('')
  const [muscle, setMuscle] = useState('all')
  const searchRef = useRef<ReturnType<typeof setTimeout>>()

  const load = useCallback(async (q: string, m: string) => {
    const params = new URLSearchParams({ q, muscle: m, limit: '50' })
    const res = await fetch(`/api/exercises?${params}`, { credentials: 'include' })
    const data = await res.json()
    setExercises(data.exercises || [])
  }, [])

  useEffect(() => {
    clearTimeout(searchRef.current)
    searchRef.current = setTimeout(() => load(query, muscle), 250)
  }, [query, muscle, load])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ width: '100%', maxWidth: 520, background: 'var(--surface)', border: '1px solid var(--border)', maxHeight: '82vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', margin: 0 }}>Add exercise</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4 }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1 1l11 11M12 1L1 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/></svg>
          </button>
        </div>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input style={S.input} type="text" placeholder="Search..." value={query} onChange={e => setQuery(e.target.value)} autoFocus />
          <div style={{ overflowX: 'auto', display: 'flex', gap: 5, paddingBottom: 2 }}>
            {MUSCLES.map(m => (
              <button key={m} style={S.chip(muscle === m)} onClick={() => setMuscle(m)}>
                {m === 'all' ? 'All' : m.replace('_',' ')}
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {exercises.map(ex => (
            <button key={ex.id} onClick={() => { onAdd(ex); onClose() }}
              style={{ width: '100%', textAlign: 'left', padding: '10px 16px', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              <p style={{ fontSize: 13, color: 'var(--text)', margin: 0, fontWeight: 500 }}>{ex.name}</p>
              <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '2px 0 0', textTransform: 'capitalize' }}>
                {ex.muscle_group.replace('_',' ')} · {ex.equipment?.slice(0,2).join(', ')}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Program Builder ────────────────────────────────────────────────────────

function ProgramBuilder({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const [name,  setName]  = useState('')
  const [goal,  setGoal]  = useState<'fat_loss'|'muscle_gain'|'maintain'>('muscle_gain')
  const [weeks, setWeeks] = useState(8)
  const [sessions, setSessions] = useState<Session[]>([
    { day_of_week: 1, focus: 'Push', exercises: [] },
  ])
  const [saving,  setSaving]  = useState(false)
  const [picker,  setPicker]  = useState<number | null>(null) // session index

  function addSession() {
    const usedDays = sessions.map(s => s.day_of_week)
    const nextDay  = [1,2,3,4,5,6,7].find(d => !usedDays.includes(d)) ?? 1
    setSessions(prev => [...prev, { day_of_week: nextDay, focus: '', exercises: [] }])
  }

  function removeSession(i: number) {
    setSessions(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateSession(i: number, field: keyof Session, value: any) {
    setSessions(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s))
  }

  function addExercise(sessionIdx: number, ex: Exercise) {
    setSessions(prev => prev.map((s, idx) => {
      if (idx !== sessionIdx) return s
      return {
        ...s, exercises: [...s.exercises, {
          exercise_id: ex.id, exercise_name: ex.name, muscle_group: ex.muscle_group,
          order_index: s.exercises.length, target_sets: 3, target_reps: '8-12', rest_seconds: 90,
        }]
      }
    }))
  }

  function removeExercise(sessionIdx: number, exIdx: number) {
    setSessions(prev => prev.map((s, idx) => {
      if (idx !== sessionIdx) return s
      return { ...s, exercises: s.exercises.filter((_, i) => i !== exIdx).map((e, i) => ({ ...e, order_index: i })) }
    }))
  }

  function updateExercise(sessionIdx: number, exIdx: number, field: string, value: any) {
    setSessions(prev => prev.map((s, idx) => {
      if (idx !== sessionIdx) return s
      return { ...s, exercises: s.exercises.map((e, i) => i === exIdx ? { ...e, [field]: value } : e) }
    }))
  }

  async function handleSave() {
    if (!name || sessions.length === 0) return
    setSaving(true)
    const res = await fetch('/api/workouts/programs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({
        name, goal, duration_weeks: weeks, days_per_week: sessions.length,
        sessions: sessions.map(s => ({
          day_of_week: s.day_of_week, focus: s.focus || 'Session',
          exercises: s.exercises.map(({ exercise_name, muscle_group, ...rest }) => rest),
        })),
      }),
    })
    if (res.ok) onSaved()
    else setSaving(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', padding: '4px 0' }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L6 8l4 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/></svg>
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--page-title)', margin: 0 }}>New program</h1>
      </div>

      {/* Program details */}
      <div style={{ ...S.card }}>
        <p style={{ ...S.lbl, marginBottom: 14 }}>Details</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <p style={{ ...S.lbl, marginBottom: 6 }}>Program name</p>
            <input style={S.input} type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Push Pull Legs" />
          </div>
          <div>
            <p style={{ ...S.lbl, marginBottom: 8 }}>Goal</p>
            <div style={{ display: 'flex', gap: 6 }}>
              {GOALS.map(g => (
                <button key={g.value} style={S.chip(goal === g.value)} onClick={() => setGoal(g.value as any)}>{g.label}</button>
              ))}
            </div>
          </div>
          <div>
            <p style={{ ...S.lbl, marginBottom: 6 }}>Duration (weeks)</p>
            <input style={{ ...S.input, width: 100 }} type="number" min={1} max={52} value={weeks} onChange={e => setWeeks(parseInt(e.target.value) || 8)} />
          </div>
        </div>
      </div>

      {/* Sessions */}
      {sessions.map((session, si) => (
        <div key={si} style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <select value={session.day_of_week} onChange={e => updateSession(si, 'day_of_week', parseInt(e.target.value))}
                style={{ padding: '5px 8px', background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text)', fontSize: 12, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
                {DAYS_SHORT.slice(1).map((d, i) => (
                  <option key={i+1} value={i+1}>{d}</option>
                ))}
              </select>
              <input style={{ ...S.input, width: 140 }} type="text" value={session.focus}
                onChange={e => updateSession(si, 'focus', e.target.value)} placeholder="Session focus" />
            </div>
            <button onClick={() => removeSession(si)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4 }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/></svg>
            </button>
          </div>

          {/* Exercises in session */}
          {session.exercises.length > 0 && (
            <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {session.exercises.map((ex, ei) => (
                <div key={ei} style={{ padding: '10px 12px', background: 'var(--surface-2)', border: '1px solid var(--border-2)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.exercise_name}</p>
                    <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '2px 0 0', textTransform: 'capitalize' }}>{ex.muscle_group.replace('_',' ')}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <input type="number" min={1} max={10} value={ex.target_sets}
                      onChange={e => updateExercise(si, ei, 'target_sets', parseInt(e.target.value) || 3)}
                      style={{ width: 40, padding: '4px 6px', background: 'var(--surface)', border: '1px solid var(--border-2)', color: 'var(--text)', fontSize: 11, fontFamily: 'DM Mono, monospace', textAlign: 'center' }} />
                    <span style={{ fontSize: 10, color: 'var(--text-3)' }}>×</span>
                    <input type="text" value={ex.target_reps}
                      onChange={e => updateExercise(si, ei, 'target_reps', e.target.value)}
                      style={{ width: 54, padding: '4px 6px', background: 'var(--surface)', border: '1px solid var(--border-2)', color: 'var(--text)', fontSize: 11, fontFamily: 'DM Mono, monospace', textAlign: 'center' }} />
                    <select value={ex.rest_seconds} onChange={e => updateExercise(si, ei, 'rest_seconds', parseInt(e.target.value))}
                      style={{ padding: '4px 6px', background: 'var(--surface)', border: '1px solid var(--border-2)', color: 'var(--text)', fontSize: 11, fontFamily: 'DM Sans, sans-serif' }}>
                      {[30,45,60,90,120,180].map(s => <option key={s} value={s}>{s}s</option>)}
                    </select>
                    <button onClick={() => removeExercise(si, ei)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 2 }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button onClick={() => setPicker(si)}
            style={{ fontSize: 11, color: 'var(--text-2)', background: 'none', border: '1px solid var(--border-2)', padding: '6px 12px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text)'; e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-2)'; e.currentTarget.style.color = 'var(--text-2)' }}>
            + Add exercise
          </button>
        </div>
      ))}

      <button onClick={addSession}
        style={{ padding: '10px', fontSize: 12, color: 'var(--text-2)', background: 'transparent', border: '1px dashed var(--border-2)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
        + Add session
      </button>

      <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
        <button onClick={onCancel}
          style={{ flex: 1, padding: '11px 0', fontSize: 13, fontWeight: 500, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border-2)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving || !name || sessions.every(s => s.exercises.length === 0)}
          style={{ flex: 2, padding: '11px 0', fontSize: 13, fontWeight: 600, background: 'var(--btn-bg)', color: 'var(--btn-fg)', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', opacity: (saving || !name) ? 0.4 : 1 }}>
          {saving ? 'Saving...' : 'Save program'}
        </button>
      </div>

      {picker !== null && (
        <ExercisePicker
          onAdd={ex => addExercise(picker, ex)}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  )
}

// ── Program Detail View ────────────────────────────────────────────────────

function ProgramDetail({ program, onBack, onDeleted }: { program: Program; onBack: () => void; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false)

  const week1sessions = program.program_weeks?.[0]?.sessions ?? []
  const sorted = [...week1sessions].sort((a,b) => a.day_of_week - b.day_of_week)

  async function handleDelete() {
    if (!confirm('Delete this program?')) return
    setDeleting(true)
    await fetch(`/api/workouts/programs/${program.id}`, { method: 'DELETE', credentials: 'include' })
    onDeleted()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', padding: '4px 0' }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L6 8l4 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/></svg>
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--page-title)', margin: 0 }}>{program.name}</h1>
          <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '2px 0 0', textTransform: 'capitalize' }}>
            {program.goal.replace('_',' ')} · {program.days_per_week} days/wk · {program.duration_weeks} weeks
          </p>
        </div>
        <button onClick={handleDelete} disabled={deleting}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4 }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1 1l11 11M12 1L1 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/></svg>
        </button>
      </div>

      {sorted.map(session => (
        <div key={session.id} style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 10, fontFamily: 'DM Mono, monospace', color: 'var(--text-3)', minWidth: 28 }}>{DAYS_SHORT[session.day_of_week]}</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{session.focus}</span>
            <span style={{ fontSize: 10, color: 'var(--text-3)', marginLeft: 'auto' }}>{session.session_exercises.length} exercises</span>
          </div>
          {[...session.session_exercises].sort((a,b) => a.order_index - b.order_index).map(se => (
            <div key={se.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
              <div>
                <p style={{ fontSize: 13, color: 'var(--text)', margin: 0 }}>{se.exercise.name}</p>
                <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '2px 0 0', textTransform: 'capitalize' }}>{se.exercise.muscle_group.replace('_',' ')}</p>
              </div>
              <p style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', color: 'var(--text-2)', margin: 0 }}>
                {se.target_sets} × {se.target_reps}
              </p>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

type View = 'list' | 'builder' | 'detail'

export default function WorkoutsPage() {
  const [view,     setView]     = useState<View>('list')
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading,  setLoading]  = useState(true)
  const [selected, setSelected] = useState<Program | null>(null)

  const loadPrograms = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/workouts/programs', { credentials: 'include' })
    const data = await res.json()
    setPrograms(data.programs || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadPrograms() }, [loadPrograms])

  if (view === 'builder') return (
    <ProgramBuilder
      onSaved={() => { loadPrograms(); setView('list') }}
      onCancel={() => setView('list')}
    />
  )

  if (view === 'detail' && selected) return (
    <ProgramDetail
      program={selected}
      onBack={() => setView('list')}
      onDeleted={() => { loadPrograms(); setView('list') }}
    />
  )

  // List view
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <p style={{ ...S.lbl, marginBottom: 4 }}>Training</p>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--page-title)', margin: 0 }}>Workouts</h1>
        </div>
        <button onClick={() => setView('builder')} className="btn" style={{ fontSize: 12, padding: '7px 13px' }}>
          + New program
        </button>
      </div>

      {loading && <p style={{ ...S.lbl, textAlign: 'center', padding: '32px 0' }}>Loading...</p>}

      {!loading && programs.length === 0 && (
        <div style={{ ...S.card, textAlign: 'center', padding: '40px 20px' }}>
          <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 16px' }}>No programs yet.</p>
          <button onClick={() => setView('builder')} className="btn" style={{ fontSize: 12 }}>Create your first program</button>
        </div>
      )}

      {programs.map(program => {
        const sessions = program.program_weeks?.[0]?.sessions ?? []
        const totalExercises = sessions.reduce((s, sess) => s + sess.session_exercises.length, 0)
        return (
          <button key={program.id} onClick={() => { setSelected(program); setView('detail') }}
            style={{ ...S.card, textAlign: 'left', border: 'none', cursor: 'pointer', width: '100%', display: 'block' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 4px' }}>{program.name}</p>
                <p style={{ fontSize: 10, color: 'var(--text-3)', margin: 0, textTransform: 'capitalize' }}>
                  {program.goal.replace('_',' ')} · {program.days_per_week} days/wk · {program.duration_weeks} wks
                </p>
              </div>
              {program.active && (
                <span style={{ fontSize: 9, padding: '3px 8px', border: '1px solid var(--green)', color: 'var(--green)', flexShrink: 0 }}>Active</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 10, color: 'var(--text-3)', fontFamily: 'DM Mono, monospace' }}>
              <span>{sessions.length} sessions</span>
              <span>{totalExercises} exercises</span>
              {sessions.map(s => DAYS_SHORT[s.day_of_week]).sort().join(' · ') && (
                <span>{sessions.map(s => DAYS_SHORT[s.day_of_week]).sort().join(' · ')}</span>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
