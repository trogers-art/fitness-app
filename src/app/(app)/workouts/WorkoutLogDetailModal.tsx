'use client'

interface LoggedSetDetail {
  id: string
  exercise_name: string
  set_number: number
  weight_kg: number | null
  reps: number | null
  completed: boolean
  logged_at: string | null
  rest_target_seconds: number | null
  rest_actual_seconds: number | null
}

interface WorkoutLogDetail {
  id: string
  name: string
  started_at: string
  completed_at: string | null
  duration_seconds: number
  calories_burned_est: number | null
  notes: string | null
  workout_log_sets: LoggedSetDetail[]
}

const S = {
  lbl: { fontSize: 9, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: 'var(--text-3)', fontWeight: 500 },
}

const kgToLbs = (kg: number) => Math.round(kg * 2.20462 * 10) / 10

export default function WorkoutLogDetailModal({ log, onClose }: { log: WorkoutLogDetail; onClose: () => void }) {
  // Group sets by exercise, preserving first-seen order
  const exerciseOrder: string[] = []
  const byExercise: Record<string, LoggedSetDetail[]> = {}
  for (const s of log.workout_log_sets) {
    if (!byExercise[s.exercise_name]) {
      byExercise[s.exercise_name] = []
      exerciseOrder.push(s.exercise_name)
    }
    byExercise[s.exercise_name].push(s)
  }
  for (const name of exerciseOrder) {
    byExercise[name].sort((a, b) => a.set_number - b.set_number)
  }

  const mins = Math.round((log.duration_seconds || 0) / 60)
  const totalSets = log.workout_log_sets.filter(s => s.completed).length

  // Compute avg rest actual vs target across the session
  const restSamples = log.workout_log_sets
    .map(s => s.rest_actual_seconds)
    .filter((r): r is number => r !== null)
  const avgRestActual = restSamples.length > 0
    ? Math.round(restSamples.reduce((a, b) => a + b, 0) / restSamples.length)
    : null

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ width: '100%', maxWidth: 480, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', maxHeight: '88vh', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: '0 0 2px' }}>{log.name}</p>
            <p style={{ fontSize: 10, color: 'var(--text-3)', margin: 0 }}>
              {new Date(log.started_at).toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4, flexShrink: 0 }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1 1l11 11M12 1L1 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/></svg>
          </button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: avgRestActual !== null ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)', borderBottom: '1px solid var(--border)' }}>
            <div style={{ padding: '12px 14px', borderRight: '1px solid var(--border)' }}>
              <p style={{ ...S.lbl, marginBottom: 4 }}>Duration</p>
              <p style={{ fontSize: 16, fontFamily: 'DM Mono, monospace', fontWeight: 600, color: 'var(--text)', margin: 0 }}>{mins}m</p>
            </div>
            <div style={{ padding: '12px 14px', borderRight: '1px solid var(--border)' }}>
              <p style={{ ...S.lbl, marginBottom: 4 }}>Sets</p>
              <p style={{ fontSize: 16, fontFamily: 'DM Mono, monospace', fontWeight: 600, color: 'var(--text)', margin: 0 }}>{totalSets}</p>
            </div>
            <div style={{ padding: '12px 14px', borderRight: avgRestActual !== null ? '1px solid var(--border)' : 'none' }}>
              <p style={{ ...S.lbl, marginBottom: 4 }}>Calories</p>
              <p style={{ fontSize: 16, fontFamily: 'DM Mono, monospace', fontWeight: 600, color: 'var(--text)', margin: 0 }}>{log.calories_burned_est ?? '—'}</p>
            </div>
            {avgRestActual !== null && (
              <div style={{ padding: '12px 14px' }}>
                <p style={{ ...S.lbl, marginBottom: 4 }}>Avg rest</p>
                <p style={{ fontSize: 16, fontFamily: 'DM Mono, monospace', fontWeight: 600, color: 'var(--text)', margin: 0 }}>{avgRestActual}s</p>
              </div>
            )}
          </div>

          {/* Exercise breakdown */}
          {exerciseOrder.map(exerciseName => {
            const sets = byExercise[exerciseName]
            return (
              <div key={exerciseName} style={{ borderBottom: '1px solid var(--border)' }}>
                <div style={{ padding: '11px 18px 6px' }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{exerciseName}</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr 1fr', gap: 0, padding: '0 18px 4px' }}>
                  <span style={S.lbl}>Set</span>
                  <span style={S.lbl}>Weight</span>
                  <span style={S.lbl}>Reps</span>
                  <span style={S.lbl}>Rest</span>
                </div>
                {sets.map(s => (
                  <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr 1fr', gap: 0, padding: '6px 18px' }}>
                    <span style={{ fontSize: 12, fontFamily: 'DM Mono, monospace', color: 'var(--text-3)' }}>{s.set_number}</span>
                    <span style={{ fontSize: 12, fontFamily: 'DM Mono, monospace', color: 'var(--text)' }}>
                      {s.weight_kg ? `${kgToLbs(s.weight_kg)} lbs` : '—'}
                    </span>
                    <span style={{ fontSize: 12, fontFamily: 'DM Mono, monospace', color: 'var(--text)' }}>
                      {s.reps ?? '—'}
                    </span>
                    <span style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', color: 'var(--text-3)' }}>
                      {s.rest_actual_seconds !== null ? `${s.rest_actual_seconds}s` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )
          })}

          {log.notes && (
            <div style={{ padding: '14px 18px' }}>
              <p style={{ ...S.lbl, marginBottom: 6 }}>Notes</p>
              <p style={{ fontSize: 12, color: 'var(--text-2)', margin: 0, lineHeight: 1.6 }}>{log.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
