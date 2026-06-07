'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import ActiveSession from './ActiveSession'

interface Exercise {
  id: string; name: string; muscle_group: string
  equipment: string[]; type: string; gif_url: string | null
}
interface SessionExercise {
  id: string; order_index: number; target_sets: number
  target_reps: string; rest_seconds: number
  exercise: { id: string; name: string; muscle_group: string; gif_url: string | null }
}
interface Session {
  id: string; day_of_week: number; focus: string
  session_exercises: SessionExercise[]
}
interface Program {
  id: string; name: string; goal: string
  duration_weeks: number; days_per_week: number
  active: boolean; ai_generated: boolean; created_at: string
  program_weeks: { id: string; week_number: number; sessions: Session[] }[]
}
interface WorkoutLog {
  id: string; name: string; started_at: string
  duration_seconds: number
  workout_log_sets: { exercise_name: string; set_number: number; weight_kg: number | null; reps: number | null }[]
}

const DAYS_SHORT = ['','Mon','Tue','Wed','Thu','Fri','Sat','Sun']
const GOALS = [
  { value: 'fat_loss',    label: 'Fat loss' },
  { value: 'muscle_gain', label: 'Muscle gain' },
  { value: 'maintain',    label: 'Maintain' },
]
const MUSCLES = ['all','chest','back','shoulders','biceps','triceps','forearms','core','quads','hamstrings','glutes','calves','full_body','cardio']
const EQUIPMENT_OPTIONS = ['barbell','dumbbell','cable','machine','bodyweight','kettlebell','resistance_band']
const EXPERIENCE = ['beginner','intermediate','advanced']

const S = {
  lbl:   { fontSize: 9, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: 'var(--text-3)', fontWeight: 500 },
  card:  { background: 'var(--surface)', border: '1px solid var(--border)', padding: '16px 18px' } as React.CSSProperties,
  input: { width: '100%', padding: '10px 12px', background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text)', fontSize: 13, fontFamily: 'DM Mono, monospace', outline: 'none' } as React.CSSProperties,
  chip:  (active: boolean): React.CSSProperties => ({
    padding: '5px 10px', fontSize: 11, border: '1px solid',
    borderColor: active ? 'var(--text)' : 'var(--border-2)',
    background: active ? 'var(--btn-bg)' : 'transparent',
    color: active ? 'var(--btn-fg)' : 'var(--text-2)',
    cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap' as const,
  }),
}

// ── Exercise Picker ────────────────────────────────────────────────────────

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
        <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', margin: 0 }}>Add exercise</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4 }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1 1l11 11M12 1L1 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/></svg>
          </button>
        </div>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
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

// ── AI Generator ───────────────────────────────────────────────────────────

function AIGenerator({ onGenerated, onCancel }: { onGenerated: (id: string, name: string, notes: { training: string; rest: string }) => void; onCancel: () => void }) {
  const [days,       setDays]       = useState(4)
  const [weeks,      setWeeks]      = useState(8)
  const [experience, setExperience] = useState('intermediate')
  const [equipment,  setEquipment]  = useState<string[]>(['barbell','dumbbell','cable','machine'])
  const [injuries,   setInjuries]   = useState('')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  function toggleEquipment(e: string) {
    setEquipment(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e])
  }

  async function handleGenerate() {
    if (equipment.length === 0) { setError('Select at least one equipment type'); return }
    setLoading(true); setError(null)
    const res = await fetch('/api/workouts/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ days_per_week: days, duration_weeks: weeks, experience, equipment, injuries: injuries || undefined }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Generation failed'); setLoading(false); return }
    onGenerated(data.program_id, data.program_name, { training: data.training_day_notes, rest: data.rest_day_notes })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', padding: '4px 0' }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L6 8l4 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/></svg>
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--page-title)', margin: 0 }}>Generate program</h1>
      </div>

      {error && <div style={{ padding: '10px 14px', borderLeft: '2px solid var(--red)', color: 'var(--red)', fontSize: 12 }}>{error}</div>}

      <div style={S.card}>
        <p style={{ ...S.lbl, marginBottom: 14 }}>Parameters</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <p style={{ ...S.lbl, marginBottom: 6 }}>Days per week</p>
              <input style={S.input} type="number" min={1} max={7} value={days} onChange={e => setDays(parseInt(e.target.value) || 4)} />
            </div>
            <div>
              <p style={{ ...S.lbl, marginBottom: 6 }}>Duration (weeks)</p>
              <input style={S.input} type="number" min={1} max={16} value={weeks} onChange={e => setWeeks(parseInt(e.target.value) || 8)} />
            </div>
          </div>

          <div>
            <p style={{ ...S.lbl, marginBottom: 8 }}>Experience level</p>
            <div style={{ display: 'flex', gap: 6 }}>
              {EXPERIENCE.map(e => (
                <button key={e} style={{ ...S.chip(experience === e), textTransform: 'capitalize' }} onClick={() => setExperience(e)}>{e}</button>
              ))}
            </div>
          </div>

          <div>
            <p style={{ ...S.lbl, marginBottom: 8 }}>Available equipment</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {EQUIPMENT_OPTIONS.map(e => (
                <button key={e} style={{ ...S.chip(equipment.includes(e)), textTransform: 'capitalize' }} onClick={() => toggleEquipment(e)}>
                  {e.replace('_',' ')}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p style={{ ...S.lbl, marginBottom: 6 }}>Injuries or limitations <span style={{ color: 'var(--text-3)' }}>(optional)</span></p>
            <input style={S.input} type="text" value={injuries} onChange={e => setInjuries(e.target.value)} placeholder="e.g. lower back, left knee" />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCancel}
          style={{ flex: 1, padding: '11px 0', fontSize: 13, fontWeight: 500, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border-2)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
          Cancel
        </button>
        <button onClick={handleGenerate} disabled={loading}
          style={{ flex: 2, padding: '11px 0', fontSize: 13, fontWeight: 600, background: 'var(--btn-bg)', color: 'var(--btn-fg)', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Generating...' : 'Generate with AI'}
        </button>
      </div>

      {loading && (
        <p style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center' }}>
          Building your program — this takes about 15 seconds...
        </p>
      )}
    </div>
  )
}

// ── Program Builder ────────────────────────────────────────────────────────

function ProgramBuilder({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const [name,  setName]  = useState('')
  const [goal,  setGoal]  = useState<'fat_loss'|'muscle_gain'|'maintain'>('muscle_gain')
  const [weeks, setWeeks] = useState(8)
  const [sessions, setSessions] = useState<{ day_of_week: number; focus: string; exercises: any[] }[]>([
    { day_of_week: 1, focus: 'Push', exercises: [] },
  ])
  const [saving, setSaving] = useState(false)
  const [picker, setPicker] = useState<number | null>(null)

  function addSession() {
    const used = sessions.map(s => s.day_of_week)
    const next = [1,2,3,4,5,6,7].find(d => !used.includes(d)) ?? 1
    setSessions(prev => [...prev, { day_of_week: next, focus: '', exercises: [] }])
  }

  function addExercise(si: number, ex: Exercise) {
    setSessions(prev => prev.map((s, idx) => idx !== si ? s : {
      ...s, exercises: [...s.exercises, {
        exercise_id: ex.id, exercise_name: ex.name, muscle_group: ex.muscle_group,
        order_index: s.exercises.length, target_sets: 3, target_reps: '8-12', rest_seconds: 60,
      }]
    }))
  }

  function removeExercise(si: number, ei: number) {
    setSessions(prev => prev.map((s, idx) => idx !== si ? s : {
      ...s, exercises: s.exercises.filter((_,i) => i !== ei).map((e,i) => ({ ...e, order_index: i }))
    }))
  }

  function updateExercise(si: number, ei: number, field: string, value: any) {
    setSessions(prev => prev.map((s, idx) => idx !== si ? s : {
      ...s, exercises: s.exercises.map((e,i) => i === ei ? { ...e, [field]: value } : e)
    }))
  }

  async function handleSave() {
    if (!name) return
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
    if (res.ok) onSaved(); else setSaving(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', padding: '4px 0' }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L6 8l4 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/></svg>
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--page-title)', margin: 0 }}>New program</h1>
      </div>

      <div style={S.card}>
        <p style={{ ...S.lbl, marginBottom: 14 }}>Details</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <p style={{ ...S.lbl, marginBottom: 6 }}>Program name</p>
            <input style={S.input} type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Push Pull Legs" />
          </div>
          <div>
            <p style={{ ...S.lbl, marginBottom: 8 }}>Goal</p>
            <div style={{ display: 'flex', gap: 6 }}>
              {GOALS.map(g => <button key={g.value} style={S.chip(goal === g.value)} onClick={() => setGoal(g.value as any)}>{g.label}</button>)}
            </div>
          </div>
          <div>
            <p style={{ ...S.lbl, marginBottom: 6 }}>Duration (weeks)</p>
            <input style={{ ...S.input, width: 100 }} type="number" min={1} max={52} value={weeks} onChange={e => setWeeks(parseInt(e.target.value) || 8)} />
          </div>
        </div>
      </div>

      {sessions.map((session, si) => (
        <div key={si} style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <select value={session.day_of_week} onChange={e => setSessions(prev => prev.map((s,i) => i===si ? {...s,day_of_week:parseInt(e.target.value)} : s))}
                style={{ padding: '5px 8px', background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text)', fontSize: 12, fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
                {DAYS_SHORT.slice(1).map((d,i) => <option key={i+1} value={i+1}>{d}</option>)}
              </select>
              <input style={{ ...S.input, width: 140 }} type="text" value={session.focus}
                onChange={e => setSessions(prev => prev.map((s,i) => i===si ? {...s,focus:e.target.value} : s))}
                placeholder="Session focus" />
            </div>
            <button onClick={() => setSessions(prev => prev.filter((_,i) => i!==si))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4 }}
              onMouseEnter={e => (e.currentTarget.style.color='var(--red)')}
              onMouseLeave={e => (e.currentTarget.style.color='var(--text-3)')}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/></svg>
            </button>
          </div>

          {session.exercises.length > 0 && (
            <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {session.exercises.map((ex, ei) => (
                <div key={ei} style={{ padding: '8px 12px', background: 'var(--surface-2)', border: '1px solid var(--border-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.exercise_name}</p>
                  </div>
                  <input type="number" min={1} max={10} value={ex.target_sets}
                    onChange={e => updateExercise(si, ei, 'target_sets', parseInt(e.target.value)||3)}
                    style={{ width: 36, padding: '3px 5px', background: 'var(--surface)', border: '1px solid var(--border-2)', color: 'var(--text)', fontSize: 11, fontFamily: 'DM Mono, monospace', textAlign: 'center' }} />
                  <span style={{ fontSize: 10, color: 'var(--text-3)' }}>×</span>
                  <input type="text" value={ex.target_reps}
                    onChange={e => updateExercise(si, ei, 'target_reps', e.target.value)}
                    style={{ width: 50, padding: '3px 5px', background: 'var(--surface)', border: '1px solid var(--border-2)', color: 'var(--text)', fontSize: 11, fontFamily: 'DM Mono, monospace', textAlign: 'center' }} />
                  <select value={ex.rest_seconds} onChange={e => updateExercise(si, ei, 'rest_seconds', parseInt(e.target.value))}
                    style={{ padding: '3px 5px', background: 'var(--surface)', border: '1px solid var(--border-2)', color: 'var(--text)', fontSize: 11, fontFamily: 'DM Sans, sans-serif' }}>
                    {[30,45,60,90,120,180].map(s => <option key={s} value={s}>{s}s</option>)}
                  </select>
                  <button onClick={() => removeExercise(si, ei)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 2 }}
                    onMouseEnter={e => (e.currentTarget.style.color='var(--red)')}
                    onMouseLeave={e => (e.currentTarget.style.color='var(--text-3)')}>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/></svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          <button onClick={() => setPicker(si)}
            style={{ fontSize: 11, color: 'var(--text-2)', background: 'none', border: '1px solid var(--border-2)', padding: '6px 12px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor='var(--text)'; e.currentTarget.style.color='var(--text)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border-2)'; e.currentTarget.style.color='var(--text-2)' }}>
            + Add exercise
          </button>
        </div>
      ))}

      <button onClick={addSession}
        style={{ padding: '10px', fontSize: 12, color: 'var(--text-2)', background: 'transparent', border: '1px dashed var(--border-2)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
        + Add session
      </button>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCancel}
          style={{ flex: 1, padding: '11px 0', fontSize: 13, fontWeight: 500, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border-2)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Cancel</button>
        <button onClick={handleSave} disabled={saving || !name}
          style={{ flex: 2, padding: '11px 0', fontSize: 13, fontWeight: 600, background: 'var(--btn-bg)', color: 'var(--btn-fg)', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', opacity: (saving||!name) ? 0.4 : 1 }}>
          {saving ? 'Saving...' : 'Save program'}
        </button>
      </div>

      {picker !== null && <ExercisePicker onAdd={ex => addExercise(picker, ex)} onClose={() => setPicker(null)} />}
    </div>
  )
}

// ── Program Detail ─────────────────────────────────────────────────────────

function ProgramDetail({ program, onBack, onDeleted, onStartSession }: {
  program: Program; onBack: () => void; onDeleted: () => void
  onStartSession: (session: Session, programId: string, programName: string) => void
}) {
  const [deleting, setDeleting] = useState(false)
  const week1 = program.program_weeks?.[0]?.sessions ?? []
  const sorted = [...week1].sort((a,b) => a.day_of_week - b.day_of_week)

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--page-title)', margin: 0 }}>{program.name}</h1>
            {program.ai_generated && <span style={{ fontSize: 9, padding: '2px 6px', border: '1px solid var(--text-3)', color: 'var(--text-3)' }}>AI</span>}
          </div>
          <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '2px 0 0', textTransform: 'capitalize' }}>
            {program.goal.replace('_',' ')} · {program.days_per_week} days/wk · {program.duration_weeks} weeks
          </p>
        </div>
        <button onClick={handleDelete} disabled={deleting}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4 }}
          onMouseEnter={e => (e.currentTarget.style.color='var(--red)')}
          onMouseLeave={e => (e.currentTarget.style.color='var(--text-3)')}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1 1l11 11M12 1L1 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/></svg>
        </button>
      </div>

      {sorted.map(session => (
        <div key={session.id} style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 10, fontFamily: 'DM Mono, monospace', color: 'var(--text-3)', minWidth: 28 }}>{DAYS_SHORT[session.day_of_week]}</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{session.focus}</span>
              <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{session.session_exercises.length} exercises</span>
            </div>
            <button onClick={() => onStartSession(session, program.id, `${program.name} — ${session.focus}`)}
              style={{ fontSize: 11, fontWeight: 600, padding: '5px 12px', background: 'var(--btn-bg)', color: 'var(--btn-fg)', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
              Start
            </button>
          </div>
          {[...session.session_exercises].sort((a,b) => a.order_index - b.order_index).map(se => (
            <div key={se.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 16px', borderBottom: '1px solid var(--border)' }}>
              <div>
                <p style={{ fontSize: 13, color: 'var(--text)', margin: 0 }}>{se.exercise.name}</p>
                <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '2px 0 0', textTransform: 'capitalize' }}>{se.exercise.muscle_group.replace('_',' ')}</p>
              </div>
              <p style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', color: 'var(--text-2)', margin: 0, flexShrink: 0 }}>
                {se.target_sets} × {se.target_reps}
              </p>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ── History ────────────────────────────────────────────────────────────────

function History({ logs }: { logs: WorkoutLog[] }) {
  if (logs.length === 0) return (
    <p style={{ ...S.lbl, textAlign: 'center', padding: '32px 0' }}>No sessions logged yet.</p>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {logs.map(log => {
        const exercises = [...new Set(log.workout_log_sets.map(s => s.exercise_name))]
        const totalSets = log.workout_log_sets.length
        const mins = Math.round((log.duration_seconds || 0) / 60)
        return (
          <div key={log.id} style={{ ...S.card }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{log.name}</p>
                <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '2px 0 0' }}>
                  {new Date(log.started_at).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', color: 'var(--text-2)', margin: 0 }}>{totalSets} sets</p>
                {mins > 0 && <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '2px 0 0' }}>{mins} min</p>}
              </div>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>
              {exercises.slice(0, 4).join(', ')}{exercises.length > 4 ? ` +${exercises.length - 4} more` : ''}
            </p>
          </div>
        )
      })}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

type View = 'list' | 'builder' | 'ai' | 'detail' | 'session'
type MainTab = 'programs' | 'history'

export default function WorkoutsPage() {
  const [view,     setView]     = useState<View>('list')
  const [tab,      setTab]      = useState<MainTab>('programs')
  const [programs, setPrograms] = useState<Program[]>([])
  const [logs,     setLogs]     = useState<WorkoutLog[]>([])
  const [loading,  setLoading]  = useState(true)
  const [selected, setSelected] = useState<Program | null>(null)
  const [activeSession, setActiveSession] = useState<{
    session: Session; programId: string; name: string
  } | null>(null)
  const [generatedNotes, setGeneratedNotes] = useState<{ training: string; rest: string } | null>(null)

  const loadPrograms = useCallback(async () => {
    setLoading(true)
    const [progRes, logRes] = await Promise.all([
      fetch('/api/workouts/programs', { credentials: 'include' }),
      fetch('/api/workouts/logs', { credentials: 'include' }),
    ])
    const [progData, logData] = await Promise.all([progRes.json(), logRes.json()])
    setPrograms(progData.programs || [])
    setLogs(logData.logs || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadPrograms() }, [loadPrograms])

  function handleStartSession(session: Session, programId: string, name: string) {
    setActiveSession({ session, programId, name })
    setView('session')
  }

  function handleSessionFinished() {
    setActiveSession(null)
    setView('detail')
    loadPrograms()
  }

  if (view === 'session' && activeSession) return (
    <ActiveSession
      programId={activeSession.programId}
      sessionId={activeSession.session.id}
      sessionName={activeSession.name}
      exercises={activeSession.session.session_exercises}
      onFinished={handleSessionFinished}
      onCancel={() => setView('detail')}
    />
  )

  if (view === 'builder') return (
    <ProgramBuilder onSaved={() => { loadPrograms(); setView('list') }} onCancel={() => setView('list')} />
  )

  if (view === 'ai') return (
    <AIGenerator
      onGenerated={(id, name, notes) => {
        setGeneratedNotes(notes)
        loadPrograms()
        setView('list')
      }}
      onCancel={() => setView('list')}
    />
  )

  if (view === 'detail' && selected) return (
    <ProgramDetail
      program={selected}
      onBack={() => setView('list')}
      onDeleted={() => { loadPrograms(); setView('list') }}
      onStartSession={handleStartSession}
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
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setView('ai')} className="btn" style={{ fontSize: 11, padding: '6px 11px', background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border-2)' }}>
            AI generate
          </button>
          <button onClick={() => setView('builder')} className="btn" style={{ fontSize: 11, padding: '6px 11px' }}>
            + Manual
          </button>
        </div>
      </div>

      {/* Generated notes banner */}
      {generatedNotes && (
        <div style={{ padding: '12px 14px', borderLeft: '2px solid var(--green)', fontSize: 12, color: 'var(--text-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div>
            <p style={{ margin: '0 0 4px', fontWeight: 500, color: 'var(--green)' }}>Program generated</p>
            <p style={{ margin: 0 }}>Training days: {generatedNotes.training}</p>
            <p style={{ margin: '2px 0 0', color: 'var(--text-3)' }}>Rest days: {generatedNotes.rest}</p>
          </div>
          <button onClick={() => setGeneratedNotes(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 0, flexShrink: 0 }}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1 1l9 9M10 1L1 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/></svg>
          </button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        {(['programs','history'] as MainTab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '9px 16px', fontSize: 11, fontWeight: tab === t ? 600 : 400,
            background: 'none', border: 'none', cursor: 'pointer',
            borderBottom: tab === t ? '2px solid var(--btn-bg)' : '2px solid transparent',
            color: tab === t ? 'var(--page-title)' : 'var(--text-3)',
            fontFamily: 'DM Sans, sans-serif', textTransform: 'capitalize',
          }}>{t}</button>
        ))}
      </div>

      {loading && <p style={{ ...S.lbl, textAlign: 'center', padding: '32px 0' }}>Loading...</p>}

      {!loading && tab === 'history' && <History logs={logs} />}

      {!loading && tab === 'programs' && (
        <>
          {programs.length === 0 && (
            <div style={{ ...S.card, textAlign: 'center', padding: '40px 20px' }}>
              <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 16px' }}>No programs yet. Build one manually or generate with AI.</p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <button onClick={() => setView('ai')} className="btn" style={{ fontSize: 12, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border-2)' }}>AI generate</button>
                <button onClick={() => setView('builder')} className="btn" style={{ fontSize: 12 }}>Build manually</button>
              </div>
            </div>
          )}

          {programs.map(program => {
            const sessions = program.program_weeks?.[0]?.sessions ?? []
            const totalEx  = sessions.reduce((s, sess) => s + sess.session_exercises.length, 0)
            return (
              <button key={program.id} onClick={() => { setSelected(program); setView('detail') }}
                style={{ ...S.card, textAlign: 'left', border: 'none', cursor: 'pointer', width: '100%', display: 'block' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{program.name}</p>
                      {program.ai_generated && <span style={{ fontSize: 9, padding: '2px 5px', border: '1px solid var(--text-3)', color: 'var(--text-3)' }}>AI</span>}
                    </div>
                    <p style={{ fontSize: 10, color: 'var(--text-3)', margin: 0, textTransform: 'capitalize' }}>
                      {program.goal.replace('_',' ')} · {program.days_per_week} days/wk · {program.duration_weeks} wks
                    </p>
                  </div>
                  {program.active && <span style={{ fontSize: 9, padding: '3px 8px', border: '1px solid var(--green)', color: 'var(--green)', flexShrink: 0 }}>Active</span>}
                </div>
                <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 10, color: 'var(--text-3)', fontFamily: 'DM Mono, monospace' }}>
                  <span>{sessions.length} sessions</span>
                  <span>{totalEx} exercises</span>
                  <span>{sessions.map(s => DAYS_SHORT[s.day_of_week]).sort().join(' · ')}</span>
                </div>
              </button>
            )
          })}
        </>
      )}
    </div>
  )
}
